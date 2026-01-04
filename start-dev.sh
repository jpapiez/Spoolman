#!/bin/bash

# Spoolman Development Environment Startup Script
# This script starts both the backend and frontend with proper configuration
# 
# Usage:
#   ./start-dev.sh              - Start the development environment
#   ./start-dev.sh --tear-down  - Stop services and delete the database

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT=${BACKEND_PORT:-8000}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
BACKEND_LOG="${SCRIPT_DIR}/backend.log"
FRONTEND_LOG="${SCRIPT_DIR}/frontend.log"
BACKEND_PID=""
FRONTEND_PID=""
DATABASE_DIR="${HOME}/.local/share/spoolman"
DATABASE_FILE="${DATABASE_DIR}/spoolman.db"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Handle --tear-down option
if [ "$1" = "--tear-down" ]; then
    echo -e "${YELLOW}🗑️  Tearing down development environment...${NC}\n"
    
    # Kill all services
    echo -e "${YELLOW}Stopping services...${NC}"
    pkill -9 -f "pdm run" 2>/dev/null || true
    pkill -9 -f "uvicorn" 2>/dev/null || true
    pkill -9 -f "npm run dev" 2>/dev/null || true
    pkill -9 -f "vite" 2>/dev/null || true
    pkill -9 -f "multiprocessing" 2>/dev/null || true
    sleep 2
    
    # Delete the database
    if [ -f "$DATABASE_FILE" ]; then
        echo -e "${YELLOW}Deleting database at ${DATABASE_FILE}...${NC}"
        rm -f "$DATABASE_FILE"
        echo -e "${GREEN}✓ Database deleted${NC}"
    else
        echo -e "${BLUE}ℹ️  No database file found at ${DATABASE_FILE}${NC}"
    fi
    
    # Delete the data directory if empty
    if [ -d "$DATABASE_DIR" ] && [ -z "$(ls -A "$DATABASE_DIR" 2>/dev/null)" ]; then
        rmdir "$DATABASE_DIR" 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✓ Tear down complete${NC}\n"
    exit 0
fi

echo -e "${BLUE}🚀 Starting Spoolman Development Environment...${NC}\n"

# Comprehensive cleanup function
cleanup() {
    local exit_code=$?
    
    # Only kill processes if interrupted (Ctrl+C), not on normal exit
    if [ ! -z "$INTERRUPTED" ]; then
        echo -e "\n${YELLOW}Shutting down services...${NC}"
        
        # Kill backend if running
        if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
            kill $BACKEND_PID 2>/dev/null || true
            sleep 1
            kill -9 $BACKEND_PID 2>/dev/null || true
        fi
        
        # Kill frontend if running
        if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
            kill $FRONTEND_PID 2>/dev/null || true
            sleep 1
            kill -9 $FRONTEND_PID 2>/dev/null || true
        fi
        
        # Kill any remaining orphaned processes
        pkill -9 -f "pdm run" 2>/dev/null || true
        pkill -9 -f "uvicorn" 2>/dev/null || true
        pkill -9 -f "npm run dev" 2>/dev/null || true
        pkill -9 -f "vite" 2>/dev/null || true
        pkill -9 -f "multiprocessing" 2>/dev/null || true
    fi
    
    exit $exit_code
}

# Handle signals gracefully
trap 'INTERRUPTED=1; cleanup' SIGINT SIGTERM
trap 'cleanup' EXIT

# Kill any existing processes before starting
echo -e "${YELLOW}🧹 Cleaning up any existing processes...${NC}"
pkill -9 -f "pdm run" 2>/dev/null || true
pkill -9 -f "uvicorn spoolman.main" 2>/dev/null || true
pkill -9 -f "uvicorn" 2>/dev/null || true
pkill -9 -f "npm run dev" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true
pkill -9 -f "multiprocessing" 2>/dev/null || true
sleep 3  # Give time for ports to be released

# Robust port cleanup function
clear_port() {
    local port=$1
    local port_type=$2
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if ! lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
            return 0
        fi
        
        echo -e "${YELLOW}⚠️  Port ${port} (${port_type}) is still in use. Forcing cleanup (attempt $attempt/$max_attempts)...${NC}"
        local pids=$(lsof -t -i :${port} 2>/dev/null | tr '\n' ' ')
        
        if [ ! -z "$pids" ]; then
            echo -e "${YELLOW}   Killing PIDs: $pids${NC}"
            kill -9 $pids 2>/dev/null || true
        fi
        
        sleep 1
        attempt=$((attempt + 1))
    done
    
    # Final check
    if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}✗ Failed to clear port ${port}. Exiting.${NC}"
        return 1
    fi
    return 0
}

# Clear ports before starting
clear_port $BACKEND_PORT "Backend" || cleanup
clear_port $FRONTEND_PORT "Frontend" || cleanup

# Check if backend dependencies are installed
if [ ! -d "${SCRIPT_DIR}/.venv" ] && [ ! -d "${HOME}/.local/share/pdm/venvs" ]; then
    echo -e "${YELLOW}Note: PDM virtual environment not found. PDM will create one on first run.${NC}\n"
fi

# Check if frontend dependencies are installed
if [ ! -d "${SCRIPT_DIR}/client/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    cd "${SCRIPT_DIR}/client"
    if ! npm install; then
        echo -e "${RED}✗ Failed to install frontend dependencies${NC}"
        cleanup
    fi
    cd "${SCRIPT_DIR}"
fi

# Start backend with error checking
echo -e "${BLUE}📡 Starting backend server on port ${BACKEND_PORT}...${NC}"
cd "${SCRIPT_DIR}"

# Clear log files
> "${BACKEND_LOG}"
> "${FRONTEND_LOG}"

# Start backend process with debug mode enabled for CORS
SPOOLMAN_DEBUG_MODE=TRUE pdm run uvicorn spoolman.main:app --reload --host 0.0.0.0 --port ${BACKEND_PORT} > "${BACKEND_LOG}" 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Verify backend process started
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}✗ Backend process terminated immediately. Check logs:${NC}"
    cat "${BACKEND_LOG}"
    cleanup
fi

# Wait for backend to be ready
echo -e "${BLUE}⏳ Waiting for backend to be ready...${NC}"
RETRY_COUNT=0
MAX_RETRIES=30
BACKEND_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Check if process is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo -e "\n${RED}✗ Backend process died${NC}"
        echo -e "${YELLOW}Backend logs:${NC}"
        tail -30 "${BACKEND_LOG}"
        cleanup
    fi
    
    if curl -s http://localhost:${BACKEND_PORT}/api/v1/vendor >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is ready${NC}\n"
        BACKEND_READY=true
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 1
done

if [ "$BACKEND_READY" = false ]; then
    echo -e "\n${RED}✗ Backend failed to respond${NC}"
    echo -e "${YELLOW}Backend logs:${NC}"
    tail -30 "${BACKEND_LOG}"
    cleanup
fi

# Start frontend
echo -e "${BLUE}🎨 Starting frontend development server on port ${FRONTEND_PORT}...${NC}"
cd "${SCRIPT_DIR}/client"

VITE_APIURL=http://localhost:${BACKEND_PORT}/api/v1 npm run dev > "${FRONTEND_LOG}" 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Verify frontend process started
sleep 2
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}✗ Frontend process terminated immediately. Check logs:${NC}"
    cat "${FRONTEND_LOG}"
    cleanup
fi

# Wait for frontend to be ready
echo -e "${BLUE}⏳ Waiting for frontend to be ready...${NC}"
RETRY_COUNT=0
FRONTEND_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Check if process is still running
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "\n${RED}✗ Frontend process died${NC}"
        echo -e "${YELLOW}Frontend logs:${NC}"
        tail -30 "${FRONTEND_LOG}"
        cleanup
    fi
    
    if curl -s http://localhost:${FRONTEND_PORT} >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend is ready${NC}\n"
        FRONTEND_READY=true
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 1
done

if [ "$FRONTEND_READY" = false ]; then
    echo -e "\n${YELLOW}⚠️  Frontend did not respond within timeout${NC}"
    echo -e "${YELLOW}Frontend logs:${NC}"
    tail -30 "${FRONTEND_LOG}"
    echo -e "${YELLOW}(Frontend may still be starting - check logs)${NC}\n"
fi

# Summary
echo -e "${GREEN}✓ All services started successfully!${NC}\n"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Spoolman Development Environment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Frontend UI:   ${BLUE}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "Backend API:   ${BLUE}http://localhost:${BACKEND_PORT}${NC}"
echo -e "Backend Logs:  ${BLUE}${BACKEND_LOG}${NC}"
echo -e "Frontend Logs: ${BLUE}${FRONTEND_LOG}${NC}"
echo -e "Backend PID:   ${BLUE}${BACKEND_PID}${NC}"
echo -e "Frontend PID:  ${BLUE}${FRONTEND_PID}${NC}"
echo ""
echo -e "${GREEN}Both services are ready and accepting requests!${NC}"
echo -e "${YELLOW}Services are running in the background. You can continue using this terminal.${NC}\n"

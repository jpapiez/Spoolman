#!/bin/bash
set -e

echo "🔄 Starting Spoolman development services..."

# Activate the virtual environment
source /home/vscode/.venv/bin/activate || true

# Run database migrations if sqlite or need it
if [ ! -f "spoolman.db" ]; then
    echo "📊 Running database migrations..."
    pdm run alembic upgrade head
fi

echo "✅ Services ready!"
echo ""
echo "To start backend:   pdm run uvicorn spoolman.main:app --reload"
echo "To start frontend:  cd client && npm run dev"

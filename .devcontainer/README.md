# Devcontainer Setup

This directory contains the development container configuration for Spoolman. A development container allows you to use a Docker container as a complete development environment with all dependencies pre-configured.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac, Windows, Linux)
- [VS Code](https://code.visualstudio.com/)
- [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

## Quick Start

1. **Open in Container**: In VS Code, press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux) and select **Dev Containers: Reopen in Container**

2. **Wait for Setup**: The container will build and initialize automatically, installing:
   - Python 3.12 with PDM
   - Node.js 20.x with npm
   - Development tools (ruff, pre-commit, etc.)
   - PostgreSQL and MariaDB for testing

3. **Start Development**:
   ```bash
   # Terminal 1: Start backend (from /workspace)
   pdm run uvicorn spoolman.main:app --reload
   
   # Terminal 2: Start frontend (from /workspace/client)
   npm run dev
   ```

## What's Included

### Container Features
- **Base Image**: Python 3.12-bookworm
- **Language Runtime**: Node.js 20.x
- **Package Managers**: PDM (Python), npm (Node.js)
- **Databases**: PostgreSQL 16, MariaDB (for integration testing)

### VS Code Extensions
- Python language support and Pylance type checker
- Ruff linter and formatter
- ESLint and Prettier
- Docker and Git extensions
- GitHub Copilot (if available)

### Pre-configured Settings
- Python: Ruff linting enabled, proper import organization
- TypeScript/React: ESLint formatting on save
- Port forwarding: 8000 (API), 5173 (Frontend dev server)

## Services

### PostgreSQL
- **Container**: `spoolman-postgres`
- **Host**: `postgres` (from within dev container)
- **Port**: 5432
- **Credentials**: 
  - User: `spoolman`
  - Password: `spoolman`
  - Database: `spoolman`

### MariaDB
- **Container**: `spoolman-mariadb`
- **Host**: `mariadb` (from within dev container)
- **Port**: 3306
- **Credentials**:
  - User: `spoolman`
  - Password: `spoolman`
  - Database: `spoolman`

### Development Container
- **Service**: `dev`
- **Ports**: 8000 (API), 5173 (Frontend)
- **Working Directory**: `/workspace`
- **User**: `vscode` (non-root)

## Common Commands

### Backend Development
```bash
# Run backend with auto-reload
pdm run uvicorn spoolman.main:app --reload

# Run tests
pdm run pytest

# Run linting checks
pdm run ruff check .

# Format code
pdm run ruff format .

# Database migrations
pdm run alembic upgrade head
```

### Frontend Development
```bash
cd client

# Start dev server
npm run dev

# Run ESLint checks
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Testing
You can test against PostgreSQL or MariaDB by setting the `DATABASE_URL` environment variable:

```bash
# PostgreSQL (from within dev container)
DATABASE_URL=postgresql://spoolman:spoolman@postgres/spoolman pdm run uvicorn spoolman.main:app --reload

# MariaDB
DATABASE_URL=mysql+pymysql://spoolman:spoolman@mariadb/spoolman pdm run uvicorn spoolman.main:app --reload
```

## Troubleshooting

### Container fails to build
- Ensure Docker daemon is running
- Try removing the container: `docker rm spoolman-dev`
- Rebuild: VS Code should rebuild automatically

### Port conflicts
- If ports 8000 or 5173 are in use, modify `.devcontainer/docker-compose.yml`
- Change the port mapping, e.g., `"8001:8000"` for port 8001 → container 8000

### Dependencies not found
- Run `pdm install --dev` to update Python dependencies
- Run `npm install` in `client/` to update Node.js dependencies

### Database connection issues
- Ensure services are running: `docker ps` should show `spoolman-postgres` and `spoolman-mariadb`
- Wait for health checks to pass (check with `docker inspect <container-name>`)

## Stopping the Container

- **Keep container running**: Containers remain running when VS Code is closed
- **Restart the container**: Press `F1` > **Dev Containers: Rebuild Container**
- **Fully stop**: Press `F1` > **Dev Containers: Reopen Folder Locally** then manually stop Docker containers

## File Structure

```
.devcontainer/
├── devcontainer.json      # VS Code devcontainer configuration
├── Dockerfile             # Custom Docker image definition
├── docker-compose.yml     # Services (dev container, databases)
├── init.sh               # Setup script (runs after container creation)
├── start.sh              # Startup script (runs on container start)
└── README.md             # This file
```

## Environment Variables

Key environment variables set in the devcontainer:

- `PDM_IGNORE_ACTIVE_VENV=1`: PDM won't use active virtual environments
- `PDM_CHECK_UPDATE=false`: Disable PDM update checks
- `PDM_VENV_IN_PROJECT=false`: Use system Python environment
- `DATABASE_URL`: SQLite default, override for PostgreSQL/MariaDB
- `VIRTUAL_ENV=/home/vscode/.venv`: Python virtual environment path

## Additional Resources

- [VS Code Dev Containers Documentation](https://code.visualstudio.com/docs/devcontainers/containers)
- [Spoolman Repository](../)
- [PDM Documentation](https://pdm-project.org/)
- [Vite Documentation](https://vitejs.dev/)

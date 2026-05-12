# Copilot Instructions for Spoolman

## Project Overview

Spoolman is a self-hosted web service for tracking 3D printer filament spools. It has a **Python/FastAPI backend** and a **React/TypeScript frontend** (Refine framework + Ant Design). The backend supports SQLite, PostgreSQL, MySQL, and CockroachDB via SQLAlchemy async drivers.

## Architecture

- **Backend** (`spoolman/`): FastAPI app with versioned REST API at `/api/v1/`. Entry point is `spoolman/main.py`, which mounts the v1 API sub-app from `spoolman/api/v1/router.py`.
- **API layer** (`spoolman/api/v1/`): Route handlers with Pydantic request/response models (`models.py`). Each resource (vendor, filament, spool, setting, field) has its own module.
- **Database layer** (`spoolman/database/`): SQLAlchemy 2.0 async ORM models in `models.py`, with per-resource modules for CRUD operations. Uses `async_sessionmaker` with dependency injection via `get_db_session`.
- **Domain model**: Three core entities — **Vendor → Filament → Spool** — with extra fields stored in separate `*Field` tables (key-value pairs per entity).
- **Migrations** (`migrations/`): Alembic with async support. Migrations run as a subprocess during startup. The env.py reads connection config from `spoolman.database.database.get_connection_url()`.
- **WebSockets** (`spoolman/ws.py`): A `SubscriptionTree` broadcasts real-time entity change events to connected clients. Clients can subscribe at different granularity levels.
- **Frontend** (`client/`): React 19 app using Refine data framework, Ant Design components, react-router, Zustand for state, and i18next for internationalization.
- **Configuration** (`spoolman/env.py`): All config is read from `SPOOLMAN_*` environment variables. See `.env.example` for the full list.

## Build & Run Commands

### Backend

```bash
# Install dependencies (uses uv, not pip)
uv sync

# Run the server
uv run poe run
# or directly:
uv run uvicorn spoolman.main:app

# Lint (ruff with ALL rules selected, line-length 120)
uv run ruff check .
uv run ruff format --check .

# Lint with auto-fix
uv run ruff check --fix .
uv run ruff format .
```

### Frontend

```bash
cd client
npm ci
npm run build        # TypeScript check + Vite build
npm run dev          # Dev server
npm run lint         # ESLint
npm run format-check # Prettier check
```

### Integration Tests

Integration tests run against a live Spoolman instance in Docker. Each supported database has its own docker-compose file in `tests_integration/`.

```bash
# Run all integration tests against all databases
uv run poe itest

# Run a single test file (inside the Docker test container)
pytest tests_integration/tests/spool/test_spool.py

# Run a single test
pytest tests_integration/tests/spool/test_spool.py::test_create_spool
```

### Pre-commit / CI

Lefthook runs both backend (ruff) and frontend (eslint, prettier) checks:

```bash
uv run lefthook run ci        # CI mode (no auto-fix)
uv run lefthook run pre-commit # Local mode (with auto-fix)
```

## Key Conventions

- **Package manager**: `uv` for Python (not pip/poetry). Lock file is `uv.lock`.
- **Ruff config**: `select = ["ALL"]` with specific ignores. Target Python 3.10. Line length 120. Test files have relaxed rules (no type annotations on return, assertions allowed, etc.).
- **Async everywhere**: All database operations use SQLAlchemy async sessions. API route handlers are async.
- **Keyword-only args**: Database CRUD functions use keyword-only arguments (`*` in signature).
- **WebSocket notifications**: Database write operations broadcast events via `websocket_manager` so clients get real-time updates.
- **Extra fields**: User-defined custom fields on Vendor/Filament/Spool are stored as key-value pairs in `*Field` tables, validated against schemas stored in settings.
- **Multi-database support**: Code must work across SQLite, PostgreSQL, MySQL, and CockroachDB. Alembic migrations use `render_as_batch=True` for SQLite compatibility.
- **Node version**: 20.x for the frontend.

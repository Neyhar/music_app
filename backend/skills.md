# backend

The `backend` directory contains the server-side application for Music_App.

## Purpose

- Hosts the FastAPI application and related backend logic.
- Defines data models, schemas, services, and background workers.
- Contains Alembic migration configuration for database schema changes.

## Key subdirectories

- `app/`: Main application package and API wiring.
- `migrations/`: Alembic database migrations and migration environment.
- `.venv/`: Local Python virtual environment (not committed normally).

## Important files

- `requirements.txt`: Python dependencies.
- `alembic.ini`: Alembic configuration.
- `music_app.db`: Local SQLite database file (untracked in Git).
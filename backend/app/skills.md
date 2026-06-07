# backend/app

This directory contains the FastAPI application code and project structure.

## Purpose

- Configure and run the API server.
- Define how the app initializes database connections, routes, and services.

## Key subdirectories

- `api/`: API route definitions and HTTP endpoints.
- `core/`: Configuration and app-level settings.
- `db/`: Database session and engine setup.
- `models/`: SQLAlchemy ORM models.
- `schemas/`: Pydantic request and response schemas.
- `services/`: Business logic, including transcription service.
- `workers/`: Background worker tasks such as transcription jobs.

## Important files

- `main.py`: Application entry point.
- `__init__.py`: Package entry for FastAPI app initialization.

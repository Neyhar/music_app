# backend/app/api

This package contains the API route definitions for the backend.

## Purpose

- Map HTTP endpoints to application logic.
- Expose REST API routes for project, track, and transcription operations.

## Notes

- Endpoints are typically implemented using FastAPI route decorators.
- This layer should remain thin, delegating business logic to services and models.

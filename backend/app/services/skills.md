# backend/app/services

This package contains application business logic and service classes.

## Purpose

- Implement core domain operations such as transcription processing.
- Coordinate actions across models, database sessions, and external systems.

## Notes

- Keep service methods reusable and plain, so they can be called from both API routes and workers.
- Avoid embedding HTTP or persistence details directly inside service logic.

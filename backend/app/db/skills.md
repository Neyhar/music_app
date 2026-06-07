# backend/app/db

This package manages the database connection and session handling.

## Purpose

- Create and configure the SQLAlchemy engine.
- Provide database sessions to the application.
- Manage transaction scope and connection lifecycle.

## Notes

- Keep database session-related code isolated from API and business logic.
- This module is the foundation for ORM access throughout the backend.

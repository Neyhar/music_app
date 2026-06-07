# backend/app/models

This package defines the database models used by the backend.

## Purpose

- Declare SQLAlchemy ORM models for domain entities.
- Define tables, relationships, and persisted fields.

## Notes

- Models should represent the canonical structure of persisted data.
- Business logic should use models through services, not manipulate raw ORM classes directly.

# backend/migrations

This directory contains Alembic migration files and the migration environment.

## Purpose

- Track database schema changes over time.
- Provide a structured way to upgrade or downgrade the database.

## Notes

- The `env.py` file configures Alembic and the target metadata.
- `versions/` contains individual revision scripts for schema changes.

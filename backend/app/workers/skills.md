# backend/app/workers

This package handles background worker tasks such as transcription jobs.

## Purpose

- Run asynchronous or long-running processes outside the main request path.
- Schedule and execute tasks that may take time, like audio transcription.

## Notes

- Workers should invoke services rather than containing heavy business logic themselves.
- Keep worker orchestration separate from API endpoint definitions.

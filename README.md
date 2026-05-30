# Music App

Small starter stack for a web app that records sung parts and converts them into MIDI.

## Stack

- `frontend/`: React + Vite + TypeScript
- `backend/`: FastAPI + SQLAlchemy + PostgreSQL-ready settings
- `storage/`: local development storage for audio and MIDI files

## Run Locally

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Copy `.env.example` to `.env` files before wiring real database credentials.

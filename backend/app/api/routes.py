import shutil
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.project import Project
from app.models.track import Track
from app.models.transcription_job import TranscriptionJob, TranscriptionStatus
from app.schemas.project import ProjectCreate, ProjectRead
from app.schemas.track import TrackCreate, TrackRead
from app.schemas.transcription_job import TranscriptionJobRead
from app.workers.transcription_worker import process_transcription_job

router = APIRouter()


@router.post("/projects", response_model=ProjectRead)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> Project:
    project = Project(name=payload.name)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.post("/tracks", response_model=TrackRead)
def create_track(payload: TrackCreate, db: Session = Depends(get_db)) -> Track:
    project = db.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    track = Track(project_id=payload.project_id, name=payload.name, role=payload.role)
    db.add(track)
    db.commit()
    db.refresh(track)
    return track


@router.post("/tracks/{track_id}/takes", response_model=TranscriptionJobRead)
def upload_take(
    track_id: UUID,
    background_tasks: BackgroundTasks,
    audio_file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> TranscriptionJob:
    track = db.get(Track, track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    job = TranscriptionJob(
        track_id=track_id,
        audio_path="pending",
    )
    db.add(job)
    db.flush()

    original_name = Path(audio_file.filename or "take.wav").name
    audio_extension = Path(original_name).suffix or ".wav"
    audio_relative_path = Path("audio") / f"{job.id}{audio_extension}"
    audio_path = settings.storage_root / audio_relative_path
    audio_path.parent.mkdir(parents=True, exist_ok=True)

    with audio_path.open("wb") as output_file:
        shutil.copyfileobj(audio_file.file, output_file)

    job.audio_path = str(audio_relative_path)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(process_transcription_job, job.id)
    return job


@router.get("/jobs/{job_id}", response_model=TranscriptionJobRead)
def get_job(job_id: UUID, db: Session = Depends(get_db)) -> TranscriptionJob:
    job = db.get(TranscriptionJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs/{job_id}/midi")
def get_job_midi(job_id: UUID, db: Session = Depends(get_db)) -> FileResponse:
    job = db.get(TranscriptionJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != TranscriptionStatus.completed or job.midi_path is None:
        raise HTTPException(status_code=409, detail="MIDI is not ready yet")

    midi_path = settings.storage_root / job.midi_path
    if not midi_path.exists():
        raise HTTPException(status_code=404, detail="MIDI file not found")

    return FileResponse(
        midi_path,
        filename=f"{job.id}.mid",
        media_type="audio/midi",
    )

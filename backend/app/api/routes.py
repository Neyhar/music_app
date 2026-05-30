from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.project import Project
from app.models.track import Track
from app.models.transcription_job import TranscriptionJob
from app.schemas.project import ProjectCreate, ProjectRead
from app.schemas.track import TrackCreate, TrackRead
from app.schemas.transcription_job import TranscriptionJobRead

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
    audio_file: UploadFile,
    db: Session = Depends(get_db),
) -> TranscriptionJob:
    track = db.get(Track, track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="Track not found")

    job = TranscriptionJob(
        track_id=track_id,
        audio_path=f"pending/{audio_file.filename}",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/jobs/{job_id}", response_model=TranscriptionJobRead)
def get_job(job_id: UUID, db: Session = Depends(get_db)) -> TranscriptionJob:
    job = db.get(TranscriptionJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

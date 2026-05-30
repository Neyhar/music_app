from datetime import datetime
from pathlib import Path
from uuid import UUID

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.track import TrackRole
from app.models.transcription_job import TranscriptionJob, TranscriptionStatus
from app.services.transcription import MidiTranscriptionService


def process_transcription_job(job_id: UUID) -> None:
    """Run a queued transcription job and persist the generated MIDI path."""
    with SessionLocal() as db:
        job = db.get(TranscriptionJob, job_id)
        if job is None:
            return

        job.status = TranscriptionStatus.processing
        db.commit()

        try:
            if job.track.role == TrackRole.rhythm:
                raise RuntimeError(
                    "Basic Pitch handles pitched material only; rhythm tracks need "
                    "the drum transcription pipeline."
                )

            audio_path = _storage_path(job.audio_path)
            midi_relative_path = Path("midi") / f"{job.id}.mid"
            midi_output_path = _storage_path(midi_relative_path)

            MidiTranscriptionService().transcribe(audio_path, midi_output_path)

            job.midi_path = str(midi_relative_path)
            job.status = TranscriptionStatus.completed
            job.completed_at = datetime.utcnow()
        except Exception:
            job.status = TranscriptionStatus.failed
        finally:
            db.commit()


def _storage_path(relative_path: str | Path) -> Path:
    return settings.storage_root / relative_path

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.transcription_job import TranscriptionStatus


class TranscriptionJobRead(BaseModel):
    id: UUID
    track_id: UUID
    status: TranscriptionStatus
    audio_path: str
    midi_path: str | None

    model_config = ConfigDict(from_attributes=True)

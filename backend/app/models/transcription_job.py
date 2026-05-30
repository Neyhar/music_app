import enum
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class TranscriptionStatus(str, enum.Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class TranscriptionJob(Base):
    __tablename__ = "transcription_jobs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    track_id: Mapped[UUID] = mapped_column(ForeignKey("tracks.id"), nullable=False)
    status: Mapped[TranscriptionStatus] = mapped_column(
        Enum(TranscriptionStatus),
        default=TranscriptionStatus.queued,
    )
    audio_path: Mapped[str] = mapped_column(String(500), nullable=False)
    midi_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    track: Mapped["Track"] = relationship(back_populates="transcription_jobs")

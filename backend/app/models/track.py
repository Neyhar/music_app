import enum
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class TrackRole(str, enum.Enum):
    melody = "melody"
    bass = "bass"
    harmony = "harmony"
    rhythm = "rhythm"


class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[TrackRole] = mapped_column(Enum(TrackRole), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship(back_populates="tracks")
    transcription_jobs: Mapped[list["TranscriptionJob"]] = relationship(
        back_populates="track",
        cascade="all, delete-orphan",
    )

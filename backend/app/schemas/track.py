from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.track import TrackRole


class TrackCreate(BaseModel):
    project_id: UUID
    name: str
    role: TrackRole


class TrackRead(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    role: TrackRole

    model_config = ConfigDict(from_attributes=True)

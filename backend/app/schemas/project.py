from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    name: str


class ProjectRead(BaseModel):
    id: UUID
    name: str

    model_config = ConfigDict(from_attributes=True)

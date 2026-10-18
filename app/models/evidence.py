from datetime import datetime
from beanie import Document
from pydantic import Field

class Evidence(Document):
    case_id: str
    submitted_by: str
    evidence_type: str = Field(..., min_length=2, max_length=50)
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    source_device: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    current_version_id: str | None = None
    next_version_no: int = 2
    deleted_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "evidence"

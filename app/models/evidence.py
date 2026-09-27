from datetime import datetime
from beanie import Document
from pydantic import Field

class Evidence(Document):
    case_id: str
    submitted_by: str
    evidence_type: str = Field(..., min_length=2, max_length=50)
    title: str = Field(..., min_length=2, max_length=255)
    current_version_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "evidence"
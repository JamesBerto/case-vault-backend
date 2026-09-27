from datetime import datetime
from beanie import Document, Indexed
from pydantic import Field

class Case(Document):
    case_number: Indexed(str, unique=True)
    case_type: str = Field(..., min_length=2, max_length=100)
    status: str = "open"
    created_by: str
    submission_date: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "cases"
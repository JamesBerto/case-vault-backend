from datetime import datetime
from beanie import Document
from pydantic import Field

class CaseTag(Document):
    case_id: str
    tag_id: str
    assigned_by: str
    assigned_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "case_tags"
        indexes = ["case_id", "tag_id"]
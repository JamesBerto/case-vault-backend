from datetime import datetime
from beanie import Document
from pydantic import Field

class EvidenceVersion(Document):
    evidence_id: str
    uploaded_by: str
    version_no: int
    file_name: str = Field(..., min_length=1, max_length=255)
    file_type: str = Field(..., min_length=1, max_length=20)
    file_hash: str = Field(..., min_length=8, max_length=128)
    storage_path: str = Field(..., min_length=1, max_length=500)
    is_tamper_flagged: bool = False
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "evidence_versions"
        indexes = ["evidence_id"]
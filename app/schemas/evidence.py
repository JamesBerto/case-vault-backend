from datetime import datetime
from pydantic import BaseModel, Field

class EvidenceCreate(BaseModel):
    case_id: str
    evidence_type: str = Field(..., min_length=2, max_length=50)
    title: str = Field(..., min_length=2, max_length=255)

class EvidenceVersionResponse(BaseModel):
    id: str
    evidence_id: str
    uploaded_by: str
    version_no: int
    file_name: str
    file_type: str
    file_hash: str
    is_tamper_flagged: bool
    uploaded_at: datetime

class EvidenceResponse(BaseModel):
    id: str
    case_id: str
    submitted_by: str
    evidence_type: str
    title: str
    current_version_id: str | None
    created_at: datetime
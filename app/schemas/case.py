from datetime import datetime
from pydantic import BaseModel, Field

class CaseCreate(BaseModel):
    case_number: str = Field(..., min_length=2, max_length=50)
    case_type: str = Field(..., min_length=2, max_length=100)

class CaseUpdate(BaseModel):
    status: str | None = None

class CaseResponse(BaseModel):
    id: str
    case_number: str
    case_type: str
    status: str
    created_by: str
    submission_date: datetime
    created_at: datetime
    updated_at: datetime
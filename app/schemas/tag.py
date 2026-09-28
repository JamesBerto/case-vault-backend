from datetime import datetime
from pydantic import BaseModel, Field

class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)

class TagResponse(BaseModel):
    id: str
    name: str

class CaseTagCreate(BaseModel):
    tag_id: str

class CaseTagResponse(BaseModel):
    id: str
    case_id: str
    tag_id: str
    assigned_by: str
    assigned_at: datetime
from datetime import datetime
from pydantic import BaseModel

class AuditResponse(BaseModel):
    id: str
    actor_user_id: str
    case_id: str | None
    evidence_id: str | None
    action: str
    metadata: dict
    occurred_at: datetime
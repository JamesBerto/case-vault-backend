from datetime import datetime
from beanie import Document
from pydantic import Field

class AuditTransaction(Document):
    actor_user_id: str
    case_id: str | None = None
    evidence_id: str | None = None
    action: str = Field(..., min_length=2, max_length=50)
    metadata: dict = Field(default_factory=dict)
    occurred_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "audit_transactions"
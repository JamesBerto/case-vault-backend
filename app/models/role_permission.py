from datetime import datetime
from beanie import Document
from pydantic import Field

class RolePermission(Document):
    role_id: str
    permission_id: str
    granted_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "role_permissions"
        indexes = ["role_id", "permission_id"]
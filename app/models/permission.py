from datetime import datetime
from beanie import Document, Indexed
from pydantic import Field

class Permission(Document):
    code: Indexed(str, unique=True)
    description: str | None = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "permissions"
from datetime import datetime
from beanie import Document, Indexed
from pydantic import EmailStr, Field

class User(Document):
    role_id: str
    name: str = Field(..., min_length=2, max_length=150)
    email: Indexed(EmailStr, unique=True)
    hashed_password: str
    is_active: bool = True
    deleted_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"

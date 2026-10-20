from datetime import datetime
from beanie import Document, Indexed
from pydantic import EmailStr, Field

class User(Document):
    role_id: str
    name: str = Field(..., min_length=2, max_length=150)
    email: Indexed(EmailStr, unique=True)
    hashed_password: str
    is_active: bool = True
    totp_enabled: bool = False
    totp_secret_encrypted: str | None = None
    totp_pending_secret_encrypted: str | None = None
    totp_pending_expires_at: datetime | None = None
    totp_last_used_step: int = -1
    totp_revision: int = 0
    last_login_at: datetime | None = None
    deleted_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"

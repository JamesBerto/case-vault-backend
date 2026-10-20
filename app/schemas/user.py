from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.core.password_policy import is_common_password

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role_id: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def require_case_vault_email(cls, value: str) -> str:
        if value.rsplit("@", 1)[-1].lower() != "casevault.org":
            raise ValueError("Email must use the @casevault.org domain")
        return value

    @field_validator("name", "role_id", mode="before")
    @classmethod
    def strip_required_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("password")
    @classmethod
    def require_nonblank_password(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Password cannot be blank")
        return value

class UserUpdate(BaseModel):
    role_id: str | None = None
    is_active: bool | None = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def reject_common_password(cls, value: str) -> str:
        if is_common_password(value):
            raise ValueError("Choose a less common password; avoid familiar words and simple sequences")
        return value

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role_id: str
    is_active: bool
    totp_enabled: bool = False
    totp_pending: bool = False
    created_at: datetime
    updated_at: datetime

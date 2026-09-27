from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role_id: str

class UserUpdate(BaseModel):
    role_id: str | None = None
    is_active: bool | None = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

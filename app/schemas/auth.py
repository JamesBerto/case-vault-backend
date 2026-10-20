from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TotpSetup(BaseModel):
    secret: str
    uri: str
    qr_image: str


class LoginChallengeResponse(BaseModel):
    status: Literal["totp_required", "totp_setup_required"]
    challenge: str
    expires_at: datetime
    setup: TotpSetup | None = None


class TotpVerifyRequest(BaseModel):
    challenge: str = Field(..., min_length=20, max_length=200)
    code: str = Field(..., pattern=r"^[0-9]{6}$")

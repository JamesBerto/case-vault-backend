from datetime import datetime
from beanie import Document, Indexed
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class RevokedToken(Document):
    token_hash: Indexed(str, unique=True)
    expires_at: datetime = Field(...)

    class Settings:
        name = "revoked_tokens"
        indexes = [IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0)]

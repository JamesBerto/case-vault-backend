import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.core.config import settings

from app.models.role import Role
from app.models.permission import Permission
from app.models.role_permission import RolePermission
from app.models.user import User
from app.models.case import Case
from app.models.tag import Tag
from app.models.case_tag import CaseTag
from app.models.evidence import Evidence
from app.models.evidence_version import EvidenceVersion
from app.models.audit_transaction import AuditTransaction

import asyncio

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("Database client not initialized yet.")
    return _client


async def init_db(retries: int = 6, delay: float = 3.0):
    global _client
    _client = AsyncIOMotorClient(settings.MONGO_URI, tlsCAFile=certifi.where())

    last_error = None
    for attempt in range(1, retries + 1):
        try:
            await init_beanie(
                database=_client[settings.DB_NAME],
                document_models=[
                    Role,
                    Permission,
                    RolePermission,
                    User,
                    Case,
                    Tag,
                    CaseTag,
                    Evidence,
                    EvidenceVersion,
                    AuditTransaction,
                ],
            )
            return
        except Exception as e:
            last_error = e
            print(f"DB connection attempt {attempt}/{retries} failed: {e}")
            if attempt < retries:
                await asyncio.sleep(delay)

    raise last_error
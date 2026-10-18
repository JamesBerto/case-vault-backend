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
from app.models.revoked_token import RevokedToken

import asyncio

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("Database client not initialized yet.")
    return _client

async def init_db(retries: int = 6, delay: float = 3.0, require_migration: bool = True):
    global _client
    options = {} if settings.MONGO_URI.startswith("mongodb://") else {"tlsCAFile": certifi.where()}
    _client = AsyncIOMotorClient(settings.MONGO_URI, **options)

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
                    RevokedToken,
                ],
            )
            if require_migration:
                indexes = await _client[settings.DB_NAME]["evidence_versions"].list_indexes().to_list(None)
                if not any(list(index["key"].items()) == [("evidence_id", 1), ("version_no", 1)] and index.get("unique") for index in indexes):
                    raise RuntimeError("Migration required: run python -m app.services.migration_service before starting the API")
                tag_indexes = await _client[settings.DB_NAME]["case_tags"].list_indexes().to_list(None)
                if not any(list(index["key"].items()) == [("case_id", 1), ("tag_id", 1)] and index.get("unique") for index in tag_indexes):
                    raise RuntimeError("Migration required: run python -m app.services.migration_service before starting the API")
                session_indexes = (await _client[settings.DB_NAME]["active_sessions"].list_indexes().to_list(None)
                                   if "active_sessions" in await _client[settings.DB_NAME].list_collection_names() else [])
                if not any(list(index["key"].items()) == [("expires_at", 1)] and index.get("expireAfterSeconds") == 0
                           for index in session_indexes):
                    raise RuntimeError("Migration required: run python -m app.services.migration_service before starting the API")
            return
        except Exception as e:
            last_error = e
            print(f"DB connection attempt {attempt}/{retries} failed: {e}")
            if attempt < retries:
                await asyncio.sleep(delay)

    raise last_error

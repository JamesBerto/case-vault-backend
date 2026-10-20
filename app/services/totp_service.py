"""TOTP setup and short-lived login challenges; no full session is issued here."""
import base64
import io
import math
import secrets
import time
from datetime import datetime, timedelta

import pyotp
import qrcode
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.database import get_client
from app.models.user import User
from app.services.audit_service import log_action
from app.services.session_service import release_user_sessions, token_fingerprint

CHALLENGE_LIFETIME = timedelta(minutes=5)
SETUP_LIFETIME = timedelta(minutes=15)
MAX_ATTEMPTS = 5


def cipher() -> Fernet:
    try:
        return Fernet(settings.TOTP_ENCRYPTION_KEY.encode())
    except (ValueError, TypeError):
        raise HTTPException(503, "Two-factor authentication needs a valid server encryption key")


def decrypt_secret(value: str | None) -> str:
    try:
        return cipher().decrypt((value or "").encode()).decode()
    except (InvalidToken, UnicodeError):
        raise HTTPException(503, "The authenticator secret could not be read; contact your administrator")


def setup_details(secret: str, email: str) -> dict:
    uri = pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="Case Vault")
    output = io.BytesIO()
    qrcode.make(uri).save(output, format="PNG")
    return {"secret": secret, "uri": uri,
            "qr_image": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode()}


def matching_step(secret: str, code: str, now: float | None = None) -> int | None:
    """Accept the current 30-second step and one adjacent step in either direction."""
    step = int(time.time() if now is None else now) // 30
    totp = pyotp.TOTP(secret)
    for candidate in (step, step - 1, step + 1):
        if pyotp.utils.strings_equal(totp.at(candidate * 30), code):
            return candidate
    return None


def challenges():
    return get_client()[settings.DB_NAME]["totp_challenges"]


def user_revision_query(user: User) -> dict:
    revision = {"totp_revision": user.totp_revision}
    if user.totp_revision == 0:
        revision = {"$or": [revision, {"totp_revision": {"$exists": False}}]}
    return {"_id": user.id, "is_active": True, "deleted_at": None, "$and": [revision]}


async def start_setup(user: User, actor_id: str) -> tuple[User, dict]:
    secret = pyotp.random_base32()
    encrypted = cipher().encrypt(secret.encode()).decode()
    expiry = datetime.utcnow() + SETUP_LIFETIME
    db = get_client()[settings.DB_NAME]
    async with await get_client().start_session() as session:
        async with session.start_transaction():
            result = await db.users.update_one(user_revision_query(user), {
                "$set": {"totp_pending_secret_encrypted": encrypted,
                         "totp_pending_expires_at": expiry}, "$inc": {"totp_revision": 1}}, session=session)
            if result.matched_count != 1:
                raise HTTPException(409, "Account changed; reload and try again")
            await log_action(actor_id, "totp_setup_started", metadata={"target": str(user.id)}, session=session)
    updated = user.model_copy(update={"totp_pending_secret_encrypted": encrypted,
                                     "totp_pending_expires_at": expiry,
                                     "totp_revision": user.totp_revision + 1})
    return updated, setup_details(secret, str(user.email))


async def issue_challenge(user: User, purpose: str) -> dict:
    now = datetime.utcnow()
    token = f"{user.id}.{secrets.token_urlsafe(32)}"
    values = {"token_hash": token_fingerprint(token), "purpose": purpose,
              "revision": user.totp_revision}
    # A new password submission replaces the challenge, but does not reset its attempt budget/window.
    record = await challenges().find_one_and_update(
        {"_id": str(user.id), "expires_at": {"$gt": now}, "attempts": {"$lt": MAX_ATTEMPTS}},
        {"$set": values}, return_document=ReturnDocument.AFTER)
    if record is None:
        try:
            record = await challenges().find_one_and_update(
                {"_id": str(user.id), "expires_at": {"$lte": now}},
                {"$set": {**values, "expires_at": now + CHALLENGE_LIFETIME, "attempts": 0}},
                upsert=True, return_document=ReturnDocument.AFTER)
        except DuplicateKeyError:
            record = await challenges().find_one({"_id": str(user.id)})
            remaining = max(1, math.ceil((record["expires_at"] - now).total_seconds())) if record else 1
            raise HTTPException(429, "Too many authenticator attempts; wait and sign in again",
                                headers={"Retry-After": str(remaining)})
    return {"challenge": token, "expires_at": record["expires_at"]}


async def check_challenge(token: str, code: str, purposes: tuple[str, ...], target: str | None = None,
                          actor_id: str | None = None):
    user_id = token.partition(".")[0]
    if target is not None and user_id != target:
        raise HTTPException(401, "Invalid authenticator challenge")
    record = await challenges().find_one_and_update(
        {"_id": user_id, "token_hash": token_fingerprint(token), "purpose": {"$in": list(purposes)},
         "expires_at": {"$gt": datetime.utcnow()}, "attempts": {"$lt": MAX_ATTEMPTS}},
        {"$inc": {"attempts": 1}}, return_document=ReturnDocument.AFTER)
    if record is None:
        raise HTTPException(401, "Authenticator challenge expired or exhausted; sign in or start setup again")
    user = await User.get(user_id)
    if user is None or not user.is_active or user.deleted_at is not None:
        raise HTTPException(403, "This account is unavailable")
    if user.totp_revision != record["revision"]:
        raise HTTPException(401, "Authenticator setup changed; sign in or start setup again")
    pending = record["purpose"] != "verify"
    if pending:
        if not user.totp_pending_expires_at or user.totp_pending_expires_at <= datetime.utcnow():
            raise HTTPException(401, "Authenticator setup expired; start setup again")
        encrypted = user.totp_pending_secret_encrypted
    else:
        if not user.totp_enabled:
            raise HTTPException(401, "Authenticator settings changed; sign in again")
        encrypted = user.totp_secret_encrypted
    step = matching_step(decrypt_secret(encrypted), code)
    if step is None:
        await log_action(actor_id or user_id, "totp_check_failed", metadata={"target": user_id})
        raise HTTPException(400, "Invalid or expired code")
    if not pending and step <= user.totp_last_used_step:
        await log_action(actor_id or user_id, "totp_check_failed", metadata={"target": user_id})
        raise HTTPException(400, "Authenticator code already used; wait for the next code")
    return user, record, step


async def apply_proof(user: User, record: dict, step: int, actor_id: str, session):
    """Consume the challenge and update the accepted step in the caller's metadata transaction."""
    query = user_revision_query(user)
    update = {"$set": {"totp_last_used_step": step}}
    if record["purpose"] == "verify":
        query["totp_enabled"] = True
        query["$and"].append({"$or": [{"totp_last_used_step": {"$lt": step}},
                                               {"totp_last_used_step": {"$exists": False}}]})
    else:
        query["totp_pending_secret_encrypted"] = user.totp_pending_secret_encrypted
        query["totp_pending_expires_at"] = {"$gt": datetime.utcnow()}
        if record["purpose"] == "enroll":
            query["totp_enabled"] = {"$ne": True}
        update["$set"].update({"totp_enabled": True, "totp_secret_encrypted": user.totp_pending_secret_encrypted,
                                 "totp_pending_secret_encrypted": None, "totp_pending_expires_at": None})
        update["$inc"] = {"totp_revision": 1}
    result = await get_client()[settings.DB_NAME].users.update_one(query, update, session=session)
    consumed = await challenges().delete_one({"_id": str(user.id), "token_hash": record["token_hash"],
                                               "revision": record["revision"],
                                               "expires_at": {"$gt": datetime.utcnow()}}, session=session)
    if result.matched_count != 1 or consumed.deleted_count != 1:
        raise HTTPException(409, "Authenticator challenge already used or account changed; try again")
    if record["purpose"] != "verify":
        await release_user_sessions(str(user.id), session)
        await log_action(actor_id, "totp_enabled", metadata={"target": str(user.id)}, session=session)


async def reset_totp(user: User, actor_id: str):
    async with await get_client().start_session() as session:
        async with session.start_transaction():
            result = await get_client()[settings.DB_NAME].users.update_one(user_revision_query(user), {
                "$set": {"totp_enabled": False, "totp_secret_encrypted": None,
                         "totp_pending_secret_encrypted": None, "totp_pending_expires_at": None,
                         "totp_last_used_step": -1}, "$inc": {"totp_revision": 1}}, session=session)
            if result.matched_count != 1:
                raise HTTPException(409, "Account changed; reload and try again")
            await challenges().delete_one({"_id": str(user.id)}, session=session)
            await release_user_sessions(str(user.id), session)
            await log_action(actor_id, "totp_reset", metadata={"target": str(user.id)}, session=session)

"""One active bearer-token slot per user, keyed by MongoDB's unique _id."""
import hashlib
from datetime import datetime, timedelta

from app.core.config import settings
from app.core.database import get_client

SESSION_LEASE = timedelta(minutes=3)


def active_sessions():
    return get_client()[settings.DB_NAME]["active_sessions"]


def token_fingerprint(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def live_session_filter(now: datetime) -> dict:
    cutoff = now - SESSION_LEASE
    return {
        "expires_at": {"$gt": now},
        "$or": [
            {"last_seen_at": {"$gt": cutoff}},
            {"last_seen_at": {"$exists": False}, "started_at": {"$gt": cutoff}},
        ],
    }


async def has_active_session(user_id: str) -> bool:
    return await active_sessions().find_one({"_id": user_id, **live_session_filter(datetime.utcnow())}) is not None


async def online_user_ids() -> list[str]:
    cursor = active_sessions().find(live_session_filter(datetime.utcnow()), {"_id": 1})
    return sorted(str(session["_id"]) for session in await cursor.to_list(None))


async def claim_session(user_id: str, token: str, expires_at: datetime, session):
    """Insert a slot or replace an expired lease; a live slot causes a duplicate _id error."""
    now = datetime.utcnow()
    cutoff = now - SESSION_LEASE
    await active_sessions().update_one(
        {"_id": user_id, "$or": [
            {"expires_at": {"$lte": now}},
            {"last_seen_at": {"$lte": cutoff}},
            {"last_seen_at": {"$exists": False}, "started_at": {"$lte": cutoff}},
            {"last_seen_at": {"$exists": False}, "started_at": {"$exists": False}},
        ]},
        {"$set": {"token_hash": token_fingerprint(token),
                  "expires_at": expires_at, "started_at": now, "last_seen_at": now}},
        upsert=True,
        session=session,
    )


async def is_active_session(user_id: str, token: str) -> bool:
    now = datetime.utcnow()
    result = await active_sessions().update_one({
        "_id": user_id,
        "token_hash": token_fingerprint(token),
        **live_session_filter(now),
    }, {"$set": {"last_seen_at": now}})
    return result.matched_count == 1


async def release_session(user_id: str, token: str, session):
    return await active_sessions().delete_one(
        {"_id": user_id, "token_hash": token_fingerprint(token)}, session=session)


async def release_user_sessions(user_id: str, session):
    return await active_sessions().delete_one({"_id": user_id}, session=session)

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi import Request
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from app.dependencies.auth import get_current_user, require_permission
from app.models.audit_transaction import AuditTransaction
from app.models.user import User
from app.services.audit_service import log_action
from app.services.session_service import online_user_ids

router = APIRouter(prefix="/audit", tags=["audit"])


def serialize_entries(entries):
    return [{"id": str(entry.id), "actor_user_id": entry.actor_user_id,
             "case_id": entry.case_id, "evidence_id": entry.evidence_id,
             "action": entry.action, "metadata": entry.metadata,
             "occurred_at": entry.occurred_at} for entry in entries]


@router.get("/integrity/latest", dependencies=[Depends(require_permission("user:manage"))])
async def latest_integrity_event(user: User = Depends(get_current_user)):
    entries = await AuditTransaction.find({"action": {"$in": [
        "evidence_verified", "evidence_verification_failed"]}}).sort("-occurred_at", "-_id").limit(1).to_list()
    await log_action(str(user.id), "audit_listed", metadata={"integrity_latest": True})
    return serialize_entries(entries)[0] if entries else None


@router.get("/stream", dependencies=[Depends(require_permission("user:manage"))])
async def stream_audit(request: Request, limit: int = Query(500, ge=1, le=500),
                       user: User = Depends(get_current_user)):
    await log_action(str(user.id), "audit_listed", metadata={"stream": True})
    token = request.headers["authorization"].partition(" ")[2]
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    check_permission = require_permission("user:manage")

    async def events():
        last_id = None
        last_presence = None
        # Check active access every 10 seconds and renew the connection each minute.
        for tick in range(30):
            if await request.is_disconnected():
                break
            if tick and tick % 5 == 0:
                try:
                    current_user = await get_current_user(credentials)
                    await check_permission(current_user)
                except HTTPException:
                    break
            latest = await AuditTransaction.find_all().sort("-occurred_at", "-_id").limit(1).to_list()
            current_id = str(latest[0].id) if latest else None
            sent = False
            if current_id != last_id:
                entries = await AuditTransaction.find_all().sort("-occurred_at", "-_id").limit(limit).to_list()
                yield f"event: ledger\ndata: {json.dumps(jsonable_encoder(serialize_entries(entries)))}\n\n"
                last_id = str(entries[0].id) if entries else None
                sent = True
            presence = await online_user_ids()
            if presence != last_presence:
                yield f"event: presence\ndata: {json.dumps(presence)}\n\n"
                last_presence = presence
                sent = True
            if not sent:
                yield ": keep-alive\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("", dependencies=[Depends(require_permission("user:manage"))])
async def list_audit(case_id: str | None = None, evidence_id: str | None = None,
                     actor_user_id: str | None = None, limit: int = Query(100, ge=1, le=500),
                     user: User = Depends(get_current_user)):
    query = {}
    for key, value in (("case_id", case_id), ("evidence_id", evidence_id), ("actor_user_id", actor_user_id)):
        if value:
            query[key] = value
    entries = await AuditTransaction.find(query).sort("-occurred_at").limit(limit).to_list()
    await log_action(str(user.id), "audit_listed", metadata={"count": len(entries)})
    return serialize_entries(entries)

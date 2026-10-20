from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from datetime import datetime, timezone
from uuid import uuid4
import asyncio
from pymongo.errors import DuplicateKeyError, OperationFailure
from app.core.security import create_access_token, verify_password, decode_access_token
from app.core.database import get_client
from app.core.config import settings
from app.dependencies.auth import get_current_user, security
from app.models.revoked_token import RevokedToken
from app.models.user import User
from app.models.role import Role
from app.schemas.auth import LoginRequest, TokenResponse, LoginChallengeResponse, TotpVerifyRequest
from app.services import totp_service
from app.services.audit_service import log_action
from app.services.session_service import (active_session_retry_after, claim_session,
                                          has_active_session, is_active_session,
                                          release_session, token_fingerprint)

router = APIRouter(prefix="/auth", tags=["auth"])


async def _already_signed_in(user_id: str) -> HTTPException:
    remaining = await active_session_retry_after(user_id)
    return HTTPException(
        status.HTTP_409_CONFLICT,
        "This account is already signed in. Sign out there or retry when its session expires.",
        headers={"Retry-After": str(remaining)} if remaining is not None else None,
    )

@router.post("/login", response_model=TokenResponse | LoginChallengeResponse)
async def login(data: LoginRequest, response: Response):
    response.headers["Cache-Control"] = "no-store"
    user = await User.find_one(User.email == data.email)

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active or user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated",
        )

    role = await Role.get(user.role_id)
    needs_setup = role is not None and role.name == "admin" and not user.totp_enabled
    if not needs_setup and await has_active_session(str(user.id)):
        raise await _already_signed_in(str(user.id))
    if needs_setup or user.totp_enabled:
        setup = None
        if needs_setup:
            user, setup = await totp_service.start_setup(user, str(user.id))
        challenge = await totp_service.issue_challenge(user, "enroll" if needs_setup else "verify")
        response.status_code = 202
        return LoginChallengeResponse(status="totp_setup_required" if needs_setup else "totp_required",
                                      setup=setup, **challenge)
    return await _finish_login(user)


async def _finish_login(user: User, proof=None):
    token = create_access_token({"sub": str(user.id), "role_id": user.role_id,
                                 "jti": uuid4().hex})
    payload = decode_access_token(token)
    expiry = datetime.fromtimestamp(payload["exp"], timezone.utc).replace(tzinfo=None)
    user_id = str(user.id)
    for attempt in range(5):
        try:
            async with await get_client().start_session() as session:
                async with session.start_transaction():
                    query = totp_service.user_revision_query(user)
                    query.update({"role_id": user.role_id, "hashed_password": user.hashed_password})
                    if proof is None:
                        query["totp_enabled"] = {"$ne": True}
                    touched = await get_client()[settings.DB_NAME].users.update_one(
                        query, {"$set": {"last_login_at": datetime.utcnow()}}, session=session)
                    if touched.matched_count != 1:
                        raise HTTPException(409, "Account changed; sign in again")
                    if proof is not None:
                        record, step = proof
                        await totp_service.apply_proof(user, record, step, user_id, session)
                    await claim_session(user_id, token, expiry, session)
                    await log_action(user_id, "login_succeeded", session=session)
            return TokenResponse(access_token=token)
        except DuplicateKeyError:
            raise await _already_signed_in(user_id)
        except OperationFailure as error:
            if error.has_error_label("UnknownTransactionCommitResult") and await is_active_session(user_id, token):
                return TokenResponse(access_token=token)
            if error.has_error_label("TransientTransactionError"):
                if await has_active_session(user_id):
                    raise await _already_signed_in(user_id)
                if attempt < 4:
                    await asyncio.sleep(0.05 * (attempt + 1))
                    continue
            raise


@router.post("/totp/verify", response_model=TokenResponse)
async def verify_totp(data: TotpVerifyRequest, response: Response):
    response.headers["Cache-Control"] = "no-store"
    user, record, step = await totp_service.check_challenge(data.challenge, data.code, ("verify", "enroll"))
    return await _finish_login(user, (record, step))


@router.post("/heartbeat", status_code=204)
async def heartbeat(current_user: User = Depends(get_current_user)):
    """Authenticated requests renew the lease; this endpoint lets idle open tabs do so."""


@router.post("/logout", status_code=204)
async def logout(current_user: User = Depends(get_current_user),
                 credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_access_token(credentials.credentials)
    expiry = datetime.fromtimestamp(payload["exp"], timezone.utc).replace(tzinfo=None)
    token_hash = token_fingerprint(credentials.credentials)
    try:
        async with await get_client().start_session() as session:
            async with session.start_transaction():
                await RevokedToken(token_hash=token_hash, expires_at=expiry).insert(session=session)
                await release_session(str(current_user.id), credentials.credentials, session)
                await log_action(str(current_user.id), "logout_succeeded", session=session)
    except DuplicateKeyError:
        pass

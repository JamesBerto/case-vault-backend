from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from datetime import datetime, timezone
from uuid import uuid4
import asyncio
from pymongo.errors import DuplicateKeyError, OperationFailure
from app.core.security import create_access_token, verify_password, decode_access_token
from app.core.database import get_client
from app.dependencies.auth import get_current_user, security
from app.models.revoked_token import RevokedToken
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.audit_service import log_action
from app.services.session_service import claim_session, has_active_session, is_active_session, release_session, token_fingerprint

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
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

    token = create_access_token({"sub": str(user.id), "role_id": user.role_id,
                                 "jti": uuid4().hex})
    payload = decode_access_token(token)
    expiry = datetime.fromtimestamp(payload["exp"], timezone.utc).replace(tzinfo=None)
    user_id = str(user.id)
    for attempt in range(5):
        try:
            async with await get_client().start_session() as session:
                async with session.start_transaction():
                    await claim_session(user_id, token, expiry, session)
                    await log_action(user_id, "login_succeeded", session=session)
            return TokenResponse(access_token=token)
        except DuplicateKeyError:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                "This account is already signed in. Sign out there or retry in up to three minutes.")
        except OperationFailure as error:
            if error.has_error_label("UnknownTransactionCommitResult") and await is_active_session(user_id, token):
                return TokenResponse(access_token=token)
            if error.has_error_label("TransientTransactionError"):
                if await has_active_session(user_id):
                    raise HTTPException(status.HTTP_409_CONFLICT,
                                        "This account is already signed in. Sign out there or retry in up to three minutes.")
                if attempt < 4:
                    await asyncio.sleep(0.05 * (attempt + 1))
                    continue
            raise


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

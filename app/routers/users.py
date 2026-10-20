from datetime import datetime
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Response, status
from app.core.security import hash_password, verify_password
from app.core.password_policy import is_common_password
from app.core.database import get_client
from app.dependencies.auth import get_current_user, require_permission, require_admin_permission
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.models.role_permission import RolePermission
from app.schemas.user import ChangePasswordRequest, UserCreate, UserResponse, UserUpdate
from app.services.audit_service import log_action
from app.services.user_service import create_user_account
from app.services.session_service import release_user_sessions
from app.schemas.auth import TotpVerifyRequest
from app.services import totp_service

router = APIRouter(prefix="/users", tags=["users"])

def _out(u: User) -> UserResponse:
    return UserResponse(
        id=str(u.id), name=u.name, email=u.email, role_id=u.role_id,
        is_active=u.is_active, created_at=u.created_at, updated_at=u.updated_at,
        totp_enabled=u.totp_enabled,
        totp_pending=bool(u.totp_pending_secret_encrypted and u.totp_pending_expires_at
                          and u.totp_pending_expires_at > datetime.utcnow()),
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    await log_action(str(current_user.id), "profile_viewed")
    return _out(current_user)


@router.get("/me/access")
async def get_my_access(current_user: User = Depends(get_current_user)):
    role = await Role.get(current_user.role_id)
    links = await RolePermission.find(RolePermission.role_id == current_user.role_id).to_list()
    permissions = [await Permission.get(link.permission_id) for link in links]
    await log_action(str(current_user.id), "access_viewed")
    return {**_out(current_user).model_dump(mode="json"),
            "role_name": role.name if role else "unknown",
            "permissions": sorted(permission.code for permission in permissions if permission)}

@router.patch("/me/password", status_code=204)
async def change_password(data: ChangePasswordRequest, current_user: User = Depends(get_current_user)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    current_user.hashed_password = hash_password(data.new_password)
    async with await get_client().start_session() as session:
        async with session.start_transaction():
            await current_user.update({"$set": {"hashed_password": current_user.hashed_password}}, session=session)
            await totp_service.challenges().delete_one({"_id": str(current_user.id)}, session=session)
            await log_action(str(current_user.id), "password_changed", session=session)

@router.post("", response_model=UserResponse, status_code=201,
             dependencies=[Depends(require_permission("user:manage"))])
async def create_user(data: UserCreate, current_user: User = Depends(get_current_user)):
    if is_common_password(data.password):
        actor_role = await Role.get(current_user.role_id)
        if actor_role is None or actor_role.name != "admin":
            raise HTTPException(422, "Common passwords are allowed only as administrator-set temporary passwords")
    if await User.find_one(User.email == data.email):
        raise HTTPException(409, "A user with this email already exists")
    if await Role.get(data.role_id) is None:
        raise HTTPException(422, "Unknown role")
    return _out(await create_user_account(data, current_user))

@router.get("", response_model=list[UserResponse],
            dependencies=[Depends(require_permission("user:manage"))])
async def list_users(current_user: User = Depends(get_current_user)):
    users = await User.find({"deleted_at": None}).to_list()
    await log_action(str(current_user.id), "users_listed", metadata={"count": len(users)})
    return [_out(u) for u in users]

@router.patch("/{user_id}", response_model=UserResponse,
              dependencies=[Depends(require_permission("user:manage"))])
async def update_user(user_id: str, data: UserUpdate, current_user: User = Depends(get_current_user)):
    try:
        user = await User.get(user_id)
    except InvalidId:
        user = None
    if user is None or user.deleted_at is not None:
        raise HTTPException(404, "User not found")
    changes = {}
    if data.role_id is not None:
        if await Role.get(data.role_id) is None:
            raise HTTPException(422, "Unknown role")
        user.role_id = data.role_id
        changes["role_id"] = data.role_id
    status_changed = data.is_active is not None and data.is_active != user.is_active
    if data.is_active is not None:
        user.is_active = data.is_active
        changes["is_active"] = data.is_active
    if changes:
        async with await get_client().start_session() as session:
            async with session.start_transaction():
                await user.update({"$set": changes}, session=session)
                if status_changed or data.role_id is not None:
                    await totp_service.challenges().delete_one({"_id": user_id}, session=session)
                if status_changed:
                    await release_user_sessions(user_id, session)
                await log_action(str(current_user.id), "user_updated",
                                 metadata={"target": user_id, **changes}, session=session)
    return _out(user)


async def _totp_target(user_id: str) -> User:
    try:
        user = await User.get(user_id)
    except (InvalidId, ValueError):
        user = None
    if user is None or user.deleted_at is not None:
        raise HTTPException(404, "User not found")
    if not user.is_active:
        raise HTTPException(403, "Reactivate this account before managing its authenticator")
    return user


@router.post("/{user_id}/totp/setup")
async def setup_user_totp(user_id: str, response: Response,
                          actor: User = Depends(require_admin_permission("user:manage"))):
    response.headers["Cache-Control"] = "no-store"
    user, setup = await totp_service.start_setup(await _totp_target(user_id), str(actor.id))
    return {**setup, **await totp_service.issue_challenge(user, "admin_setup")}


@router.post("/{user_id}/totp/confirm", response_model=UserResponse)
async def confirm_user_totp(user_id: str, data: TotpVerifyRequest,
                            actor: User = Depends(require_admin_permission("user:manage"))):
    user, record, step = await totp_service.check_challenge(data.challenge, data.code, ("admin_setup",), user_id, str(actor.id))
    async with await get_client().start_session() as session:
        async with session.start_transaction():
            await totp_service.apply_proof(user, record, step, str(actor.id), session)
    return _out(await User.get(user_id))


@router.post("/{user_id}/totp/reset", response_model=UserResponse)
async def reset_user_totp(user_id: str, actor: User = Depends(require_admin_permission("user:manage"))):
    user = await _totp_target(user_id)
    await totp_service.reset_totp(user, str(actor.id))
    return _out(await User.get(user_id))

from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import hash_password, verify_password
from app.core.password_policy import is_common_password
from app.core.database import get_client
from app.dependencies.auth import get_current_user, require_permission
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.models.role_permission import RolePermission
from app.schemas.user import ChangePasswordRequest, UserCreate, UserResponse, UserUpdate
from app.services.audit_service import log_action
from app.services.user_service import create_user_account
from app.services.session_service import release_user_sessions

router = APIRouter(prefix="/users", tags=["users"])

def _out(u: User) -> UserResponse:
    return UserResponse(
        id=str(u.id), name=u.name, email=u.email, role_id=u.role_id,
        is_active=u.is_active, created_at=u.created_at, updated_at=u.updated_at,
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
            await current_user.save(session=session)
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
                await user.save(session=session)
                if status_changed:
                    await release_user_sessions(user_id, session)
                await log_action(str(current_user.id), "user_updated",
                                 metadata={"target": user_id, **changes}, session=session)
    return _out(user)

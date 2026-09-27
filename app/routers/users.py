from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import hash_password, verify_password
from app.dependencies.auth import get_current_user, require_permission
from app.models.user import User
from app.schemas.user import ChangePasswordRequest, UserCreate, UserResponse, UserUpdate
from app.services.audit_service import log_action
from app.services.user_service import create_user_account

router = APIRouter(prefix="/users", tags=["users"])

def _out(u: User) -> UserResponse:
    return UserResponse(
        id=str(u.id), name=u.name, email=u.email, role_id=u.role_id,
        is_active=u.is_active, created_at=u.created_at, updated_at=u.updated_at,
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return _out(current_user)

@router.patch("/me/password", status_code=204)
async def change_password(data: ChangePasswordRequest, current_user: User = Depends(get_current_user)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    current_user.hashed_password = hash_password(data.new_password)
    await current_user.save()

@router.post("", response_model=UserResponse, status_code=201,
             dependencies=[Depends(require_permission("user:manage"))])
async def create_user(data: UserCreate, current_user: User = Depends(get_current_user)):
    if await User.find_one(User.email == data.email):
        raise HTTPException(409, "A user with this email already exists")
    return _out(await create_user_account(data, current_user))

@router.get("", response_model=list[UserResponse],
            dependencies=[Depends(require_permission("user:manage"))])
async def list_users():
    return [_out(u) for u in await User.find_all().to_list()]

@router.patch("/{user_id}", response_model=UserResponse,
              dependencies=[Depends(require_permission("user:manage"))])
async def update_user(user_id: str, data: UserUpdate, current_user: User = Depends(get_current_user)):
    user = await User.get(user_id)
    if user is None:
        raise HTTPException(404, "User not found")
    changes = {}
    if data.role_id is not None:
        user.role_id = data.role_id
        changes["role_id"] = data.role_id
    if data.is_active is not None:
        user.is_active = data.is_active
        changes["is_active"] = data.is_active
    if changes:
        await user.save()
        await log_action(str(current_user.id), "user_updated", metadata={"target": user_id, **changes})
    return _out(user)
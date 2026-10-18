from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.security import decode_access_token
from app.models.permission import Permission
from app.models.role_permission import RolePermission
from app.models.user import User
from app.models.role import Role
from app.models.revoked_token import RevokedToken
from app.services.session_service import is_active_session, token_fingerprint

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    token_hash = token_fingerprint(credentials.credentials)
    if await RevokedToken.find_one(RevokedToken.token_hash == token_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session has ended")

    user_id = payload.get("sub")
    user = await User.get(user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    if not user.is_active or user.deleted_at is not None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated")
    if not await is_active_session(str(user.id), credentials.credentials):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session has ended")
    return user


def require_permission(code: str):
    async def checker(current_user: User = Depends(get_current_user)) -> User:
        permission = await Permission.find_one(Permission.code == code)
        if permission is None:
            raise HTTPException(500, f"Permission '{code}' is not configured.")
        link = await RolePermission.find_one(
            RolePermission.role_id == current_user.role_id,
            RolePermission.permission_id == str(permission.id),
        )
        if link is None:
            raise HTTPException(403, f"You lack permission: {code}")
        return current_user
    return checker


def require_admin_permission(code: str):
    async def checker(user: User = Depends(require_permission(code))) -> User:
        role = await Role.get(user.role_id)
        if role is None or role.name != "admin":
            raise HTTPException(403, "Admin role required")
        return user
    return checker

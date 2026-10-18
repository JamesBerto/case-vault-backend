from fastapi import APIRouter, Depends
from app.dependencies.auth import get_current_user, require_permission
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.permission import Permission
from app.models.user import User
from app.services.audit_service import log_action

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", dependencies=[Depends(require_permission("user:manage"))])
async def list_roles(user: User = Depends(get_current_user)):
    roles = await Role.find_all().to_list()
    await log_action(str(user.id), "roles_listed")
    result = []
    for role in roles:
        links = await RolePermission.find(RolePermission.role_id == str(role.id)).to_list()
        permissions = [await Permission.get(link.permission_id) for link in links]
        result.append({"id": str(role.id), "name": role.name, "description": role.description,
                       "permissions": sorted(permission.code for permission in permissions if permission)})
    return result

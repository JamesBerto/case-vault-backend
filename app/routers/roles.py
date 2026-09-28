from fastapi import APIRouter, Depends

from app.dependencies.auth import require_permission
from app.models.role import Role
from app.schemas.role import RoleResponse

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleResponse],
            dependencies=[Depends(require_permission("user:manage"))])
async def list_roles():
    """Lists all roles so an admin can pick a role_id when creating users."""
    roles = await Role.find_all().to_list()
    return [
        RoleResponse(id=str(r.id), name=r.name, description=r.description)
        for r in roles
    ]
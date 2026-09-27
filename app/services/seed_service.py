import asyncio
from app.core.database import init_db
from app.core.security import hash_password
from app.models.role import Role
from app.models.permission import Permission
from app.models.role_permission import RolePermission
from app.models.user import User

ROLES = ["admin", "analyst", "reviewer"]

PERMISSIONS = [
    "case:create",
    "case:view",
    "case:update_status",
    "case:delete",
    "evidence:upload",
    "evidence:view",
    "user:manage",
]

ROLE_PERMISSION_MAP = {
    "admin": PERMISSIONS,
    "analyst": ["case:create", "case:view", "evidence:upload", "evidence:view"],
    "reviewer": ["case:view", "case:update_status", "evidence:view"],
}

FIRST_ADMIN_EMAIL = "admin@casevault.org"
FIRST_ADMIN_PASSWORD = "ChangeMe123!"


async def seed_roles() -> dict[str, Role]:
    roles = {}
    for role_name in ROLES:
        role = await Role.find_one(Role.name == role_name)
        if role is None:
            role = Role(name=role_name, description=f"{role_name.capitalize()} role")
            await role.insert()
            print(f"Created role: {role_name}")
        roles[role_name] = role
    return roles


async def seed_permissions() -> dict[str, Permission]:
    permissions = {}
    for code in PERMISSIONS:
        permission = await Permission.find_one(Permission.code == code)
        if permission is None:
            permission = Permission(code=code, description=code.replace(":", " "))
            await permission.insert()
            print(f"Created permission: {code}")
        permissions[code] = permission
    return permissions


async def seed_role_permissions(roles, permissions) -> None:
    for role_name, codes in ROLE_PERMISSION_MAP.items():
        role = roles[role_name]
        for code in codes:
            permission = permissions[code]
            existing = await RolePermission.find_one(
                RolePermission.role_id == str(role.id),
                RolePermission.permission_id == str(permission.id),
            )
            if existing is None:
                await RolePermission(
                    role_id=str(role.id), permission_id=str(permission.id)
                ).insert()
                print(f"Linked role '{role_name}' -> permission '{code}'")


async def seed_first_admin(roles) -> None:
    existing = await User.find_one(User.email == FIRST_ADMIN_EMAIL)
    if existing is not None:
        print("Admin account already exists, skipping.")
        return

    admin_role = roles["admin"]
    await User(
        role_id=str(admin_role.id),
        name="System Admin",
        email=FIRST_ADMIN_EMAIL,
        hashed_password=hash_password(FIRST_ADMIN_PASSWORD),
        is_active=True,
    ).insert()
    print(f"Created first admin: {FIRST_ADMIN_EMAIL} / {FIRST_ADMIN_PASSWORD}")


async def run_seed():
    await init_db()
    roles = await seed_roles()
    permissions = await seed_permissions()
    await seed_role_permissions(roles, permissions)
    await seed_first_admin(roles)
    print("Seeding complete.")


if __name__ == "__main__":
    asyncio.run(run_seed())
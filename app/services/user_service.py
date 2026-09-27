from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate
from app.services.audit_service import log_action

async def create_user_account(data: UserCreate, actor: User) -> User:
    user = User(
        role_id=data.role_id, name=data.name, email=data.email,
        hashed_password=hash_password(data.password), is_active=True,
    )
    await user.insert()
    await log_action(
        actor_user_id=str(actor.id), action="user_created",
        metadata={"new_user_id": str(user.id), "role_id": data.role_id},
    )
    return user
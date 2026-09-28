from app.core.database import get_client
from app.core.config import settings
from app.core.security import hash_password
from app.models.audit_transaction import AuditTransaction
from app.models.user import User
from app.schemas.user import UserCreate

async def create_user_account(data: UserCreate, actor: User) -> User:
    client = get_client()
    user = User(
        role_id=data.role_id, name=data.name, email=data.email,
        hashed_password=hash_password(data.password), is_active=True,
    )

    async with await client.start_session() as session:
        async with session.start_transaction():
            await user.insert(session=session)
            await AuditTransaction(
                actor_user_id=str(actor.id), action="user_created",
                metadata={"new_user_id": str(user.id), "role_id": data.role_id},
            ).insert(session=session)

    return user
from pydantic import BaseModel


class RoleResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
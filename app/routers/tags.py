from fastapi import APIRouter, Depends, HTTPException
from bson.errors import InvalidId
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError
from app.core.database import get_client

from app.dependencies.auth import get_current_user, require_admin_permission, require_permission
from app.models.case_tag import CaseTag
from app.models.role import Role
from app.models.tag import Tag
from app.models.user import User
from app.routers.cases import active_case
from app.services.audit_service import log_action

router = APIRouter(tags=["tags"])


def require_tag_permission(code: str, forbidden_builtin_role: str):
    async def checker(user: User = Depends(require_permission(code))):
        role = await Role.get(user.role_id)
        if role and role.name == forbidden_builtin_role:
            raise HTTPException(403, f"You lack permission: {code}")
        return user
    return checker


class TagCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)


class TagAssignment(BaseModel):
    tag_id: str


def out(tag: Tag):
    return {"id": str(tag.id), "name": tag.name}


@router.post("/tags", status_code=201,
             dependencies=[Depends(require_tag_permission("tag:create", "reviewer"))])
async def create_tag(data: TagCreate, user: User = Depends(get_current_user)):
    name = data.name.strip()
    if len(name) < 2:
        raise HTTPException(422, "Tag name must be 2 to 50 characters")
    try:
        tag = Tag(name=name)
        async with await get_client().start_session() as session:
            async with session.start_transaction():
                await tag.insert(session=session)
                await log_action(str(user.id), "tag_created", metadata={"tag_id": str(tag.id)}, session=session)
    except DuplicateKeyError:
        raise HTTPException(409, "A tag with this name already exists")
    return out(tag)


@router.get("/tags", dependencies=[Depends(require_permission("case:view"))])
async def list_tags(user: User = Depends(get_current_user)):
    tags = await Tag.find_all().to_list()
    await log_action(str(user.id), "tags_listed", metadata={"count": len(tags)})
    return [out(t) for t in tags]


@router.delete("/tags/{tag_id}", status_code=204,
               dependencies=[Depends(require_admin_permission("tag:create"))])
async def delete_tag(tag_id: str, user: User = Depends(get_current_user)):
    try:
        async with await get_client().start_session() as session:
            async with session.start_transaction():
                tag = await Tag.get(tag_id, session=session)
                if tag is None:
                    raise HTTPException(404, "Tag not found")
                links = await CaseTag.get_motor_collection().find(
                    {"tag_id": tag_id}, session=session).to_list(None)
                await CaseTag.get_motor_collection().delete_many(
                    {"tag_id": tag_id}, session=session)
                await Tag.get_motor_collection().delete_one(
                    {"_id": tag.id}, session=session)
                for link in links:
                    await log_action(str(user.id), "tag_removed", case_id=link["case_id"],
                                     metadata={"tag_id": tag_id}, session=session)
                await log_action(str(user.id), "tag_deleted",
                                 metadata={"tag_id": tag_id, "tag_name": tag.name,
                                           "removed_assignments": len(links)}, session=session)
    except InvalidId:
        raise HTTPException(404, "Tag not found")


@router.get("/cases/{case_id}/tags", dependencies=[Depends(require_permission("case:view"))])
async def case_tags(case_id: str, user: User = Depends(get_current_user)):
    await active_case(case_id)
    links = await CaseTag.find(CaseTag.case_id == case_id).to_list()
    tags = [await Tag.get(link.tag_id) for link in links]
    await log_action(str(user.id), "case_tags_listed", case_id=case_id)
    return [out(t) for t in tags if t is not None]


@router.post("/cases/{case_id}/tags", status_code=201,
             dependencies=[Depends(require_permission("tag:assign"))])
async def assign_tag(case_id: str, data: TagAssignment, user: User = Depends(get_current_user)):
    await active_case(case_id)
    try:
        tag = await Tag.get(data.tag_id)
    except InvalidId:
        tag = None
    if tag is None:
        raise HTTPException(404, "Tag not found")
    if await CaseTag.find_one(CaseTag.case_id == case_id, CaseTag.tag_id == data.tag_id):
        raise HTTPException(409, "This tag is already assigned to the case")
    link = CaseTag(case_id=case_id, tag_id=data.tag_id, assigned_by=str(user.id))
    try:
        async with await get_client().start_session() as session:
            async with session.start_transaction():
                touched = await Tag.get_motor_collection().update_one(
                    {"_id": tag.id}, {"$inc": {"assignment_revision": 1}}, session=session)
                if touched.matched_count != 1:
                    raise HTTPException(404, "Tag not found")
                await link.insert(session=session)
                await log_action(str(user.id), "tag_assigned", case_id=case_id,
                                 metadata={"tag_id": data.tag_id}, session=session)
    except DuplicateKeyError:
        raise HTTPException(409, "This tag is already assigned to the case")
    return out(tag)


@router.delete("/cases/{case_id}/tags/{tag_id}", status_code=204,
               dependencies=[Depends(require_permission("case:view"))])
async def remove_tag(case_id: str, tag_id: str, user: User = Depends(get_current_user)):
    await active_case(case_id)
    link = await CaseTag.find_one(CaseTag.case_id == case_id, CaseTag.tag_id == tag_id)
    if link is None:
        raise HTTPException(404, "Tag assignment not found")
    async with await get_client().start_session() as session:
        async with session.start_transaction():
            removed = await CaseTag.get_motor_collection().delete_one(
                {"_id": link.id}, session=session)
            if removed.deleted_count != 1:
                raise HTTPException(404, "Tag assignment not found")
            await log_action(str(user.id), "tag_removed", case_id=case_id,
                             metadata={"tag_id": tag_id}, session=session)

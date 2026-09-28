from fastapi import APIRouter, Depends, HTTPException
from app.dependencies.auth import get_current_user, require_permission
from app.models.case import Case
from app.models.case_tag import CaseTag
from app.models.tag import Tag
from app.models.user import User
from app.schemas.tag import CaseTagCreate, CaseTagResponse, TagCreate, TagResponse
from app.services.audit_service import log_action

router = APIRouter(tags=["tags"])


def _tag_out(t: Tag) -> TagResponse:
    return TagResponse(id=str(t.id), name=t.name)


def _case_tag_out(ct: CaseTag) -> CaseTagResponse:
    return CaseTagResponse(
        id=str(ct.id), case_id=ct.case_id, tag_id=ct.tag_id,
        assigned_by=ct.assigned_by, assigned_at=ct.assigned_at,
    )


@router.post("/tags", response_model=TagResponse, status_code=201,
             dependencies=[Depends(require_permission("case:create"))])
async def create_tag(data: TagCreate):
    existing = await Tag.find_one(Tag.name == data.name)
    if existing:
        raise HTTPException(409, "This tag already exists")
    tag = Tag(name=data.name)
    await tag.insert()
    return _tag_out(tag)


@router.get("/tags", response_model=list[TagResponse],
            dependencies=[Depends(require_permission("case:view"))])
async def list_tags():
    tags = await Tag.find_all().to_list()
    return [_tag_out(t) for t in tags]


@router.post("/cases/{case_id}/tags", response_model=CaseTagResponse, status_code=201,
             dependencies=[Depends(require_permission("case:update_status"))])
async def add_tag_to_case(case_id: str, data: CaseTagCreate, current_user: User = Depends(get_current_user)):
    case = await Case.get(case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(404, "Case not found")

    tag = await Tag.get(data.tag_id)
    if tag is None:
        raise HTTPException(404, "Tag not found")

    existing = await CaseTag.find_one(
        CaseTag.case_id == case_id, CaseTag.tag_id == data.tag_id
    )
    if existing:
        raise HTTPException(409, "This tag is already assigned to this case")

    case_tag = CaseTag(case_id=case_id, tag_id=data.tag_id, assigned_by=str(current_user.id))
    await case_tag.insert()

    await log_action(str(current_user.id), "tag_assigned", case_id=case_id,
                      metadata={"tag_id": data.tag_id, "tag_name": tag.name})

    return _case_tag_out(case_tag)


@router.get("/cases/{case_id}/tags", response_model=list[TagResponse],
            dependencies=[Depends(require_permission("case:view"))])
async def list_case_tags(case_id: str):
    links = await CaseTag.find(CaseTag.case_id == case_id).to_list()
    tags = []
    for link in links:
        tag = await Tag.get(link.tag_id)
        if tag:
            tags.append(_tag_out(tag))
    return tags


@router.delete("/cases/{case_id}/tags/{tag_id}", status_code=204,
               dependencies=[Depends(require_permission("case:update_status"))])
async def remove_tag_from_case(case_id: str, tag_id: str, current_user: User = Depends(get_current_user)):
    link = await CaseTag.find_one(CaseTag.case_id == case_id, CaseTag.tag_id == tag_id)
    if link is None:
        raise HTTPException(404, "This tag is not assigned to this case")
    await link.delete()
    await log_action(str(current_user.id), "tag_removed", case_id=case_id, metadata={"tag_id": tag_id})
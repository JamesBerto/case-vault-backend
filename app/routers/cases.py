from app.core.database import get_client
from app.models.audit_transaction import AuditTransaction
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies.auth import get_current_user, require_permission
from app.models.case import Case
from app.models.user import User
from app.schemas.case import CaseCreate, CaseResponse, CaseUpdate
from app.services.audit_service import log_action

router = APIRouter(prefix="/cases", tags=["cases"])

def _out(c: Case) -> CaseResponse:
    return CaseResponse(
        id=str(c.id), case_number=c.case_number, case_type=c.case_type,
        status=c.status, created_by=c.created_by, submission_date=c.submission_date,
        created_at=c.created_at, updated_at=c.updated_at,
    )

@router.post("", response_model=CaseResponse, status_code=201,
             dependencies=[Depends(require_permission("case:create"))])
async def create_case(data: CaseCreate, current_user: User = Depends(get_current_user)):
    if await Case.find_one(Case.case_number == data.case_number):
        raise HTTPException(409, "A case with this number already exists")

    case = Case(case_number=data.case_number, case_type=data.case_type, created_by=str(current_user.id))

    client = get_client()
    async with await client.start_session() as session:
        async with session.start_transaction():
            await case.insert(session=session)
            await AuditTransaction(
                actor_user_id=str(current_user.id), action="case_created",
                case_id=str(case.id),
            ).insert(session=session)

    return _out(case)

@router.get("", response_model=list[CaseResponse],
            dependencies=[Depends(require_permission("case:view"))])
async def list_cases(
    status: str | None = Query(default=None),
    case_type: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Search case_number"),
):
    query = {"deleted_at": None}
    if status:
        query["status"] = status
    if case_type:
        query["case_type"] = case_type
    if q:
        query["case_number"] = {"$regex": q, "$options": "i"}

    cases = await Case.find(query).to_list()
    return [_out(c) for c in cases]

@router.get("/{case_id}", response_model=CaseResponse,
            dependencies=[Depends(require_permission("case:view"))])
async def get_case(case_id: str):
    case = await Case.get(case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(404, "Case not found")
    return _out(case)

@router.patch("/{case_id}", response_model=CaseResponse,
              dependencies=[Depends(require_permission("case:update_status"))])
async def update_case(case_id: str, data: CaseUpdate, current_user: User = Depends(get_current_user)):
    case = await Case.get(case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(404, "Case not found")
    if data.status is not None:
        case.status = data.status
        case.updated_at = datetime.utcnow()
        await case.save()
        await log_action(str(current_user.id), "case_status_updated", case_id=case_id, metadata={"new_status": data.status})
    return _out(case)

@router.delete("/{case_id}", status_code=204,
               dependencies=[Depends(require_permission("case:delete"))])
async def delete_case(case_id: str, current_user: User = Depends(get_current_user)):
    case = await Case.get(case_id)
    if case is None or case.deleted_at is not None:
        raise HTTPException(404, "Case not found")
    case.deleted_at = datetime.utcnow()
    await case.save()
    await log_action(str(current_user.id), "case_deleted", case_id=case_id)
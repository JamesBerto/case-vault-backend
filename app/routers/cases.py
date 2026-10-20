"""Case endpoints. Date filters cover whole UTC calendar days; stored dates are naive UTC."""
import re
import asyncio
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from bson.errors import InvalidId
from pymongo.errors import DuplicateKeyError, OperationFailure

from app.core.database import get_client
from app.dependencies.auth import get_current_user, require_admin_permission, require_permission
from app.models.case import Case
from app.models.user import User
from app.schemas.case import CaseCreate, CaseResponse, CaseUpdate
from app.services.audit_service import log_action

router = APIRouter(prefix="/cases", tags=["cases"])
PHILIPPINE_TIME = timezone(timedelta(hours=8))


async def next_case_number(day: date) -> str:
    """Find the next date-based number, including archived records so numbers stay unique."""
    prefix = day.strftime("%Y%m%d")
    existing = await Case.find({"case_number": {"$regex": f"^{prefix}-[0-9]+$"}}).to_list()
    highest = max((int(item.case_number[len(prefix) + 1:]) for item in existing), default=0)
    return f"{prefix}-{highest + 1:03d}"


def _out(c: Case) -> CaseResponse:
    return CaseResponse(id=str(c.id), case_number=c.case_number, case_type=c.case_type,
                        status=c.status, created_by=c.created_by, submission_date=c.submission_date,
                        created_at=c.created_at, updated_at=c.updated_at)


async def active_case(case_id: str) -> Case:
    try:
        case = await Case.get(case_id)
    except (InvalidId, ValueError):
        case = None
    if case is None or case.deleted_at is not None:
        raise HTTPException(404, "Case not found")
    return case


@router.post("", response_model=CaseResponse, status_code=201,
             dependencies=[Depends(require_permission("case:create"))])
async def create_case(data: CaseCreate, current_user: User = Depends(get_current_user)):
    day = datetime.now(PHILIPPINE_TIME).date()
    for attempt in range(10):
        number = data.case_number or await next_case_number(day)
        case = Case(case_number=number, case_type=data.case_type, created_by=str(current_user.id))
        try:
            async with await get_client().start_session() as session:
                async with session.start_transaction():
                    await case.insert(session=session)
                    await log_action(str(current_user.id), "case_created", case_id=str(case.id), session=session)
            return _out(case)
        except DuplicateKeyError:
            if data.case_number is not None:
                raise HTTPException(409, "A case with this number already exists")
        except OperationFailure as exc:
            if data.case_number is not None or not exc.has_error_label("TransientTransactionError"):
                raise
        if attempt < 9:
            await asyncio.sleep(0.01 * (attempt + 1))
    raise HTTPException(409, "Could not allocate a unique case number; please retry")


@router.get("/next-number", dependencies=[Depends(require_permission("case:create"))])
async def preview_next_case_number():
    return {"case_number": await next_case_number(datetime.now(PHILIPPINE_TIME).date())}


@router.get("", response_model=list[CaseResponse],
            dependencies=[Depends(require_permission("case:view"))])
async def list_cases(status: str | None = None, case_type: str | None = None,
                     q: str | None = None, analyst_id: str | None = None,
                     submitted_from: date | None = None, submitted_to: date | None = None,
                     current_user: User = Depends(get_current_user)):
    """analyst_id matches case.created_by; submitted dates match case.submission_date in UTC."""
    if submitted_from and submitted_to and submitted_from > submitted_to:
        raise HTTPException(422, "submitted_from must be on or before submitted_to")
    query = {"deleted_at": None}
    if status is not None:
        query["status"] = status
    if case_type is not None:
        query["case_type"] = case_type
    if q:
        query["case_number"] = {"$regex": re.escape(q), "$options": "i"}
    if analyst_id:
        query["created_by"] = analyst_id
    if submitted_from or submitted_to:
        bounds = {}
        if submitted_from:
            bounds["$gte"] = datetime.combine(submitted_from, time.min)
        if submitted_to:
            if submitted_to == date.max:
                bounds["$lte"] = datetime.max
            else:
                bounds["$lt"] = datetime.combine(submitted_to + timedelta(days=1), time.min)
        query["submission_date"] = bounds
    cases = await Case.find(query).to_list()
    await log_action(str(current_user.id), "cases_listed", metadata={"count": len(cases)})
    return [_out(c) for c in cases]


@router.get("/deleted", response_model=list[CaseResponse],
            dependencies=[Depends(require_admin_permission("case:delete"))])
async def list_deleted_cases(current_user: User = Depends(get_current_user)):
    cases = await Case.find({"deleted_at": {"$ne": None}}).to_list()
    await log_action(str(current_user.id), "deleted_cases_listed", metadata={"count": len(cases)})
    return [_out(c) for c in cases]


@router.get("/deleted/{case_id}", response_model=CaseResponse,
            dependencies=[Depends(require_admin_permission("case:delete"))])
async def get_deleted_case(case_id: str, current_user: User = Depends(get_current_user)):
    case = await Case.get(case_id)
    if case is None or case.deleted_at is None:
        raise HTTPException(404, "Deleted case not found")
    await log_action(str(current_user.id), "deleted_case_viewed", case_id=case_id)
    return _out(case)


@router.get("/{case_id}", response_model=CaseResponse,
            dependencies=[Depends(require_permission("case:view"))])
async def get_case(case_id: str, current_user: User = Depends(get_current_user)):
    case = await active_case(case_id)
    await log_action(str(current_user.id), "case_viewed", case_id=case_id)
    return _out(case)


@router.patch("/{case_id}", response_model=CaseResponse,
              dependencies=[Depends(require_permission("case:update_status"))])
async def update_case(case_id: str, data: CaseUpdate, current_user: User = Depends(get_current_user)):
    case = await active_case(case_id)
    if data.status is not None:
        async with await get_client().start_session() as session:
            async with session.start_transaction():
                case.status = data.status
                case.updated_at = datetime.utcnow()
                await case.save(session=session)
                await log_action(str(current_user.id), "case_status_updated", case_id=case_id,
                                 metadata={"new_status": data.status}, session=session)
    return _out(case)


@router.delete("/{case_id}", status_code=204,
               dependencies=[Depends(require_admin_permission("case:delete"))])
async def delete_case(case_id: str, current_user: User = Depends(get_current_user)):
    case = await active_case(case_id)
    async with await get_client().start_session() as session:
        async with session.start_transaction():
            case.deleted_at = datetime.utcnow()
            await case.save(session=session)
            await log_action(str(current_user.id), "case_deleted", case_id=case_id, session=session)

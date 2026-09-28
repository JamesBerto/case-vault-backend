from fastapi import APIRouter, Depends, Query
from app.dependencies.auth import require_permission
from app.models.audit_transaction import AuditTransaction
from app.schemas.audit import AuditResponse

router = APIRouter(prefix="/audit", tags=["audit"])


def _out(a: AuditTransaction) -> AuditResponse:
    return AuditResponse(
        id=str(a.id), actor_user_id=a.actor_user_id, case_id=a.case_id,
        evidence_id=a.evidence_id, action=a.action, metadata=a.metadata,
        occurred_at=a.occurred_at,
    )


@router.get("", response_model=list[AuditResponse],
            dependencies=[Depends(require_permission("user:manage"))])
async def list_audit_logs(
    case_id: str | None = Query(default=None),
    evidence_id: str | None = Query(default=None),
    actor_user_id: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
):
    """
    Returns audit log entries, most recent first. Optional filters narrow
    the results to a specific case, piece of evidence, or user.
    Restricted to admins (uses 'user:manage' permission) since this is
    sensitive system-wide activity data.
    """
    query = {}
    if case_id:
        query["case_id"] = case_id
    if evidence_id:
        query["evidence_id"] = evidence_id
    if actor_user_id:
        query["actor_user_id"] = actor_user_id

    entries = (
        await AuditTransaction.find(query)
        .sort(-AuditTransaction.occurred_at)
        .limit(limit)
        .to_list()
    )
    return [_out(e) for e in entries]
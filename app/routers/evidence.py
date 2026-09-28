from app.core.database import get_client
from app.models.audit_transaction import AuditTransaction

import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.dependencies.auth import get_current_user, require_permission
from app.models.evidence import Evidence
from app.models.evidence_version import EvidenceVersion
from app.models.user import User
from app.schemas.evidence import EvidenceResponse, EvidenceVersionResponse
from app.services.audit_service import log_action
from app.services.storage_service import fetch_file, store_file, verify_integrity

router = APIRouter(prefix="/evidence", tags=["evidence"])

ALLOWED_TYPES = {"application/pdf"}


def _evidence_out(e: Evidence) -> EvidenceResponse:
    return EvidenceResponse(
        id=str(e.id), case_id=e.case_id, submitted_by=e.submitted_by,
        evidence_type=e.evidence_type, title=e.title,
        current_version_id=e.current_version_id, created_at=e.created_at,
    )


def _version_out(v: EvidenceVersion) -> EvidenceVersionResponse:
    return EvidenceVersionResponse(
        id=str(v.id), evidence_id=v.evidence_id, uploaded_by=v.uploaded_by,
        version_no=v.version_no, file_name=v.file_name, file_type=v.file_type,
        file_hash=v.file_hash, is_tamper_flagged=v.is_tamper_flagged,
        uploaded_at=v.uploaded_at,
    )


@router.post("", response_model=EvidenceResponse, status_code=201,
             dependencies=[Depends(require_permission("evidence:upload"))])
async def upload_evidence(
    case_id: str = Form(...),
    evidence_type: str = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only PDF files are accepted")

    file_bytes = await file.read()
    storage_path, file_hash = await store_file(file_bytes, file.filename)

    evidence = Evidence(
        case_id=case_id, submitted_by=str(current_user.id),
        evidence_type=evidence_type, title=title,
    )
    version = EvidenceVersion(
        evidence_id="", uploaded_by=str(current_user.id),
        version_no=1, file_name=file.filename, file_type=file.content_type,
        file_hash=file_hash, storage_path=storage_path,
    )

    client = get_client()
    async with await client.start_session() as session:
        async with session.start_transaction():
            await evidence.insert(session=session)
            version.evidence_id = str(evidence.id)
            await version.insert(session=session)
            evidence.current_version_id = str(version.id)
            await evidence.save(session=session)
            await AuditTransaction(
                actor_user_id=str(current_user.id), action="evidence_uploaded",
                case_id=case_id, evidence_id=str(evidence.id),
                metadata={"version_no": 1, "file_hash": file_hash},
            ).insert(session=session)

    return _evidence_out(evidence)


@router.post("/{evidence_id}/versions", response_model=EvidenceVersionResponse, status_code=201,
             dependencies=[Depends(require_permission("evidence:upload"))])
async def upload_new_version(
    evidence_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Uploads a replacement file. The original version is never deleted."""
    evidence = await Evidence.get(evidence_id)
    if evidence is None:
        raise HTTPException(404, "Evidence not found")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only PDF files are accepted")

    existing_versions = await EvidenceVersion.find(
        EvidenceVersion.evidence_id == evidence_id
    ).to_list()
    next_version_no = len(existing_versions) + 1

    file_bytes = await file.read()
    storage_path, file_hash = await store_file(file_bytes, file.filename)

    version = EvidenceVersion(
        evidence_id=evidence_id, uploaded_by=str(current_user.id),
        version_no=next_version_no, file_name=file.filename,
        file_type=file.content_type, file_hash=file_hash, storage_path=storage_path,
    )
    await version.insert()

    evidence.current_version_id = str(version.id)
    await evidence.save()

    await log_action(str(current_user.id), "evidence_version_added",
                      case_id=evidence.case_id, evidence_id=evidence_id,
                      metadata={"version_no": next_version_no, "file_hash": file_hash})

    return _version_out(version)


@router.get("/by-case/{case_id}", response_model=list[EvidenceResponse],
            dependencies=[Depends(require_permission("evidence:view"))])
async def list_evidence_for_case(case_id: str):
    """Lists all evidence records submitted under a given case."""
    items = await Evidence.find(Evidence.case_id == case_id).to_list()
    return [_evidence_out(e) for e in items]


@router.get("/{evidence_id}/versions", response_model=list[EvidenceVersionResponse],
            dependencies=[Depends(require_permission("evidence:view"))])
async def list_versions(evidence_id: str):
    versions = await EvidenceVersion.find(EvidenceVersion.evidence_id == evidence_id).to_list()
    return [_version_out(v) for v in versions]


@router.get("/{evidence_id}/versions/{version_id}/verify",
            dependencies=[Depends(require_permission("evidence:view"))])
async def verify_version(evidence_id: str, version_id: str, current_user: User = Depends(get_current_user)):
    """Re-hashes the stored file and checks it against the recorded hash."""
    version = await EvidenceVersion.get(version_id)
    if version is None or version.evidence_id != evidence_id:
        raise HTTPException(404, "Version not found")

    is_intact = await verify_integrity(version.storage_path, version.file_hash)

    if not is_intact and not version.is_tamper_flagged:
        version.is_tamper_flagged = True
        await version.save()
        await log_action(str(current_user.id), "tamper_flagged",
                          evidence_id=evidence_id, metadata={"version_id": version_id})

    return {"version_id": version_id, "intact": is_intact, "is_tamper_flagged": version.is_tamper_flagged}


@router.get("/{evidence_id}/versions/{version_id}/download",
            dependencies=[Depends(require_permission("evidence:view"))])
async def download_version(evidence_id: str, version_id: str):
    """Streams the actual stored PDF file back to the client."""
    version = await EvidenceVersion.get(version_id)
    if version is None or version.evidence_id != evidence_id:
        raise HTTPException(404, "Version not found")

    file_bytes = await fetch_file(version.storage_path)

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=version.file_type,
        headers={"Content-Disposition": f'attachment; filename="{version.file_name}"'},
    )
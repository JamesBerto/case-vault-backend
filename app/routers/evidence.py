"""Evidence metadata is transactional; GridFS bytes are stored before the transaction."""
import asyncio
import io
from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from gridfs.errors import NoFile
from pypdf import PdfReader
from pymongo import ReturnDocument
from pymongo.errors import OperationFailure, PyMongoError

from app.core.database import get_client
from app.dependencies.auth import get_current_user, require_admin_permission, require_permission
from app.models.case import Case
from app.models.evidence import Evidence
from app.models.evidence_version import EvidenceVersion
from app.models.audit_transaction import AuditTransaction
from app.models.user import User
from app.routers.cases import active_case
from app.schemas.evidence import EvidenceResponse, EvidenceVersionResponse
from app.services.audit_service import log_action
from app.services.storage_service import delete_file, fetch_file, store_file, verify_integrity

router = APIRouter(prefix="/evidence", tags=["evidence"])
MAX_FILE_SIZE = 25 * 1024 * 1024


def _evidence_out(e: Evidence) -> EvidenceResponse:
    return EvidenceResponse(id=str(e.id), case_id=e.case_id, submitted_by=e.submitted_by,
                            evidence_type=e.evidence_type, title=e.title,
                            description=e.description, source_device=e.source_device, notes=e.notes,
                            current_version_id=e.current_version_id, created_at=e.created_at)


def _version_out(v: EvidenceVersion) -> EvidenceVersionResponse:
    return EvidenceVersionResponse(id=str(v.id), evidence_id=v.evidence_id,
                                   uploaded_by=v.uploaded_by, version_no=v.version_no,
                                   file_name=v.file_name, file_type=v.file_type,
                                   file_hash=v.file_hash, is_tamper_flagged=v.is_tamper_flagged,
                                   uploaded_at=v.uploaded_at)


def _validate_pdf(file: UploadFile, data: bytes) -> None:
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(413, "PDF exceeds the 25 MB limit")
    if (file.content_type != "application/pdf" or not file.filename or
            len(file.filename) > 255 or not file.filename.lower().endswith(".pdf")):
        raise HTTPException(400, "Only PDF files are accepted")
    try:
        reader = PdfReader(io.BytesIO(data), strict=True)
        if not reader.pages:
            raise ValueError("No pages")
        for page in reader.pages:
            _ = page.mediabox
    except Exception as exc:
        raise HTTPException(400, "Invalid PDF content") from exc


async def _active_evidence(evidence_id: str) -> Evidence:
    try:
        item = await Evidence.get(evidence_id)
    except (InvalidId, ValueError):
        item = None
    if item is None or item.deleted_at is not None:
        raise HTTPException(404, "Evidence not found")
    await active_case(item.case_id)
    return item


async def _version(evidence_id: str, version_id: str) -> EvidenceVersion:
    try:
        version = await EvidenceVersion.get(version_id)
    except (InvalidId, ValueError):
        version = None
    if version is None or version.evidence_id != evidence_id:
        raise HTTPException(404, "Version not found")
    return version


async def _cleanup(path: str) -> None:
    try:
        await delete_file(path)
    except Exception as exc:
        raise RuntimeError(f"Metadata write failed and GridFS cleanup also failed for {path}") from exc


@router.post("", response_model=EvidenceResponse, status_code=201,
             dependencies=[Depends(require_permission("evidence:upload"))])
async def upload_evidence(case_id: str = Form(...), evidence_type: str = Form(..., min_length=2, max_length=50),
                          title: str = Form(..., min_length=2, max_length=255),
                          description: str | None = Form(None, max_length=2000),
                          source_device: str | None = Form(None, max_length=200),
                          notes: str | None = Form(None, max_length=2000),
                          file: UploadFile = File(...),
                          current_user: User = Depends(get_current_user)):
    await active_case(case_id)
    data = await file.read()
    _validate_pdf(file, data)
    path, digest = await store_file(data, file.filename)
    item = Evidence(case_id=case_id, submitted_by=str(current_user.id),
                    evidence_type=evidence_type, title=title, description=description,
                    source_device=source_device, notes=notes)
    try:
        async with await get_client().start_session() as session:
            async with session.start_transaction():
                # Touch the parent so a concurrent soft deletion conflicts with this transaction.
                parent = await Case.get_motor_collection().update_one(
                    {"_id": ObjectId(case_id), "deleted_at": None},
                    {"$set": {"updated_at": datetime.utcnow()}}, session=session)
                if parent.matched_count != 1:
                    raise HTTPException(404, "Case not found")
                await item.insert(session=session)
                version = EvidenceVersion(evidence_id=str(item.id), uploaded_by=str(current_user.id),
                                          version_no=1, file_name=file.filename,
                                          file_type="application/pdf", file_hash=digest, storage_path=path)
                await version.insert(session=session)
                item.current_version_id = str(version.id)
                await item.save(session=session)
                await log_action(str(current_user.id), "evidence_uploaded", case_id=case_id,
                                 evidence_id=str(item.id), metadata={"version_no": 1, "file_hash": digest}, session=session)
    except Exception as exc:
        if not (isinstance(exc, PyMongoError) and exc.has_error_label("UnknownTransactionCommitResult")):
            await _cleanup(path)
        raise
    return _evidence_out(item)


@router.get("/by-case/{case_id}", response_model=list[EvidenceResponse],
            dependencies=[Depends(require_permission("evidence:view"))])
async def list_evidence(case_id: str, current_user: User = Depends(get_current_user)):
    await active_case(case_id)
    items = await Evidence.find({"case_id": case_id, "deleted_at": None}).to_list()
    await log_action(str(current_user.id), "evidence_listed", case_id=case_id, metadata={"count": len(items)})
    return [_evidence_out(item) for item in items]


@router.get("/deleted/{evidence_id}", response_model=EvidenceResponse,
            dependencies=[Depends(require_admin_permission("evidence:delete"))])
async def inspect_deleted_evidence(evidence_id: str, current_user: User = Depends(get_current_user)):
    item = await Evidence.get(evidence_id)
    if item is None:
        raise HTTPException(404, "Evidence not found")
    parent = await Case.get(item.case_id)
    if item.deleted_at is None and (parent is None or parent.deleted_at is None):
        raise HTTPException(404, "Deleted evidence not found")
    await log_action(str(current_user.id), "deleted_evidence_viewed", case_id=item.case_id, evidence_id=evidence_id)
    return _evidence_out(item)


@router.get("/deleted", response_model=list[EvidenceResponse],
            dependencies=[Depends(require_admin_permission("evidence:delete"))])
async def list_deleted_evidence(current_user: User = Depends(get_current_user)):
    items = await Evidence.find_all().to_list()
    parents = {item.case_id: await Case.get(item.case_id) for item in items}
    deleted = [item for item in items if item.deleted_at is not None or
               parents[item.case_id] is None or parents[item.case_id].deleted_at is not None]
    await log_action(str(current_user.id), "deleted_evidence_listed", metadata={"count": len(deleted)})
    return [_evidence_out(item) for item in deleted]


@router.get("/{evidence_id}", response_model=EvidenceResponse,
            dependencies=[Depends(require_permission("evidence:view"))])
async def get_evidence(evidence_id: str, current_user: User = Depends(get_current_user)):
    item = await _active_evidence(evidence_id)
    await log_action(str(current_user.id), "evidence_viewed", case_id=item.case_id, evidence_id=evidence_id)
    return _evidence_out(item)


@router.post("/{evidence_id}/versions", response_model=EvidenceVersionResponse, status_code=201,
             dependencies=[Depends(require_permission("evidence:upload"))])
async def upload_new_version(evidence_id: str, file: UploadFile = File(...),
                             current_user: User = Depends(get_current_user)):
    item = await _active_evidence(evidence_id)
    data = await file.read()
    _validate_pdf(file, data)
    path, digest = await store_file(data, file.filename)
    try:
        for attempt in range(8):
            try:
                async with await get_client().start_session() as session:
                    async with session.start_transaction():
                        # A write to the evidence document serializes concurrent version allocations.
                        updated = await Evidence.get_motor_collection().find_one_and_update(
                            {"_id": ObjectId(evidence_id), "deleted_at": None},
                            {"$inc": {"next_version_no": 1}},
                            return_document=ReturnDocument.BEFORE, session=session)
                        if updated is None:
                            raise HTTPException(404, "Evidence not found")
                        parent = await Case.get_motor_collection().update_one(
                            {"_id": ObjectId(item.case_id), "deleted_at": None},
                            {"$set": {"updated_at": datetime.utcnow()}}, session=session)
                        if parent.matched_count != 1:
                            raise HTTPException(404, "Case not found")
                        number = updated["next_version_no"]
                        version = EvidenceVersion(evidence_id=evidence_id, uploaded_by=str(current_user.id),
                                                  version_no=number, file_name=file.filename,
                                                  file_type="application/pdf", file_hash=digest, storage_path=path)
                        await version.insert(session=session)
                        await Evidence.get_motor_collection().update_one(
                            {"_id": ObjectId(evidence_id)}, {"$set": {"current_version_id": str(version.id)}}, session=session)
                        await log_action(str(current_user.id), "evidence_version_added", case_id=item.case_id,
                                         evidence_id=evidence_id, metadata={"version_no": number, "file_hash": digest},
                                         session=session)
                return _version_out(version)
            except PyMongoError as exc:
                if exc.has_error_label("TransientTransactionError") and attempt < 7:
                    await asyncio.sleep(0.02 * (attempt + 1))
                    continue
                raise
    except Exception as exc:
        if not (isinstance(exc, PyMongoError) and exc.has_error_label("UnknownTransactionCommitResult")):
            await _cleanup(path)
        raise


@router.get("/{evidence_id}/versions", response_model=list[EvidenceVersionResponse],
            dependencies=[Depends(require_permission("evidence:view"))])
async def list_versions(evidence_id: str, current_user: User = Depends(get_current_user)):
    item = await _active_evidence(evidence_id)
    versions = await EvidenceVersion.find(EvidenceVersion.evidence_id == evidence_id).sort("version_no").to_list()
    await log_action(str(current_user.id), "versions_listed", case_id=item.case_id, evidence_id=evidence_id)
    return [_version_out(v) for v in versions]


@router.get("/{evidence_id}/versions/{version_id}", response_model=EvidenceVersionResponse,
            dependencies=[Depends(require_permission("evidence:view"))])
async def get_version(evidence_id: str, version_id: str, current_user: User = Depends(get_current_user)):
    item = await _active_evidence(evidence_id)
    version = await _version(evidence_id, version_id)
    await log_action(str(current_user.id), "version_viewed", case_id=item.case_id, evidence_id=evidence_id,
                     metadata={"version_id": version_id})
    return _version_out(version)


@router.get("/{evidence_id}/versions/{version_id}/download",
            dependencies=[Depends(require_permission("evidence:view"))])
async def download_version(evidence_id: str, version_id: str, current_user: User = Depends(get_current_user)):
    item = await _active_evidence(evidence_id)
    version = await _version(evidence_id, version_id)
    data = await fetch_file(version.storage_path)
    await log_action(str(current_user.id), "evidence_downloaded", case_id=item.case_id, evidence_id=evidence_id,
                     metadata={"version_id": version_id})
    safe_name = version.file_name.replace("\\", "/").split("/")[-1].replace('"', '').replace("\r", "").replace("\n", "")
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{safe_name}"'})


@router.get("/{evidence_id}/versions/{version_id}/verification-status",
            dependencies=[Depends(require_permission("evidence:view"))])
async def verification_status(evidence_id: str, version_id: str, current_user: User = Depends(get_current_user)):
    item = await _active_evidence(evidence_id)
    await _version(evidence_id, version_id)
    entries = await AuditTransaction.find({
        "evidence_id": evidence_id,
        "metadata.version_id": version_id,
        "action": {"$in": ["evidence_verified", "evidence_verification_failed"]},
    }).sort("-occurred_at", "-_id").limit(1).to_list()
    await log_action(str(current_user.id), "verification_status_viewed", case_id=item.case_id,
                     evidence_id=evidence_id, metadata={"version_id": version_id})
    if not entries:
        return {"version_id": version_id, "status": "Not checked", "checked_at": None,
                "actor_user_id": None, "intact": None}
    entry = entries[0]
    intact = entry.metadata.get("intact") if entry.action == "evidence_verified" else None
    status = ("Check failed" if entry.action == "evidence_verification_failed" else
              "Intact" if intact is True else "Mismatch detected" if intact is False else "Result unavailable")
    return {"version_id": version_id, "status": status, "checked_at": entry.occurred_at,
            "actor_user_id": entry.actor_user_id, "intact": intact}


@router.get("/{evidence_id}/versions/{version_id}/verify",
            dependencies=[Depends(require_permission("evidence:view"))])
async def verify_version(evidence_id: str, version_id: str, current_user: User = Depends(get_current_user)):
    item = await _active_evidence(evidence_id)
    version = await _version(evidence_id, version_id)
    try:
        intact = await verify_integrity(version.storage_path, version.file_hash)
    except (NoFile, OSError, PyMongoError, InvalidId) as exc:
        await log_action(str(current_user.id), "evidence_verification_failed", case_id=item.case_id,
                         evidence_id=evidence_id, metadata={"version_id": version_id, "reason": "stored_file_unavailable"})
        raise HTTPException(503, "Stored evidence could not be read; verification was not completed") from exc
    if not intact and not version.is_tamper_flagged:
        async with await get_client().start_session() as session:
            async with session.start_transaction():
                version.is_tamper_flagged = True
                await version.save(session=session)
                await log_action(str(current_user.id), "tamper_flagged", case_id=item.case_id,
                                 evidence_id=evidence_id, metadata={"version_id": version_id}, session=session)
    check = await log_action(str(current_user.id), "evidence_verified", case_id=item.case_id,
                             evidence_id=evidence_id, metadata={"version_id": version_id, "intact": intact})
    return {"version_id": version_id, "intact": intact, "is_tamper_flagged": version.is_tamper_flagged,
            "checked_at": check.occurred_at, "actor_user_id": str(current_user.id)}


@router.delete("/{evidence_id}", status_code=204,
               dependencies=[Depends(require_admin_permission("evidence:delete"))])
async def delete_evidence(evidence_id: str, current_user: User = Depends(get_current_user)):
    item = await _active_evidence(evidence_id)
    async with await get_client().start_session() as session:
        async with session.start_transaction():
            item.deleted_at = datetime.utcnow()
            await item.save(session=session)
            await log_action(str(current_user.id), "evidence_deleted", case_id=item.case_id,
                             evidence_id=evidence_id, session=session)

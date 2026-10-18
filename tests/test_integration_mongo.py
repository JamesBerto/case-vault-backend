"""Run only with TEST_MONGO_URI. Every run creates and drops a new test database."""
import asyncio
import io
import os
from datetime import datetime, timedelta
from uuid import uuid4

import httpx
import pytest
from bson import ObjectId
from pypdf import PdfWriter
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings
from app.core import database as database_module
from app.core.database import get_client
from app.main import app
from app.models.audit_transaction import AuditTransaction
from app.models.evidence import Evidence
from app.models.evidence_version import EvidenceVersion
from app.models.permission import Permission
from app.models.role_permission import RolePermission
from app.models.user import User
from app.services.migration_service import run_migration
from app.services.seed_service import run_seed
from app.services.session_service import SESSION_LEASE


def pdf_bytes():
    output = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.write(output)
    return output.getvalue()


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def expect(response, status):
    assert response.status_code == status, response.text
    return response.json() if response.content and response.headers.get("content-type", "").startswith("application/json") else response


async def exercise_database(monkeypatch):
    test_uri = os.environ["TEST_MONGO_URI"]
    test_db = f"cv_test_{uuid4().hex[:24]}"
    assert test_db != settings.DB_NAME
    original_uri, original_db = settings.MONGO_URI, settings.DB_NAME
    probe = AsyncIOMotorClient(test_uri, serverSelectionTimeoutMS=10000)
    try:
        assert (await probe.admin.command("hello")).get("setName"), "MongoDB replica set required"
    finally:
        probe.close()
    settings.MONGO_URI = test_uri
    settings.DB_NAME = test_db
    client = None
    try:
        await run_seed()
        client = get_client()
        db = client[test_db]
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as api:
            login = expect(await api.post("/auth/login", json={
                "email": "admin@casevault.org", "password": "ChangeMe123!"}), 200)
            admin_token = login["access_token"]
            admin = auth(admin_token)
            second_admin_login = expect(await api.post("/auth/login", json={
                "email": "admin@casevault.org", "password": "ChangeMe123!"}), 409)
            assert "already signed in" in second_admin_login["detail"]
            access = expect(await api.get("/users/me/access", headers=admin), 200)
            assert access["role_name"] == "admin" and "user:manage" in access["permissions"]
            roles = expect(await api.get("/roles", headers=admin), 200)
            role_ids = {role["name"]: role["id"] for role in roles}
            assign_permission = await Permission.find_one(Permission.code == "tag:assign")
            create_permission = await Permission.find_one(Permission.code == "tag:create")
            analyst_assign_link = await RolePermission.find_one(
                RolePermission.role_id == role_ids["analyst"],
                RolePermission.permission_id == str(assign_permission.id))
            await analyst_assign_link.delete()  # Simulate a database seeded before analysts could assign tags.
            await RolePermission(role_id=role_ids["reviewer"], permission_id=str(create_permission.id)).insert()
            await run_migration()
            await run_migration()
            session_indexes = await db.active_sessions.list_indexes().to_list(None)
            assert any(list(index["key"].items()) == [("expires_at", 1)]
                       and index.get("expireAfterSeconds") == 0 for index in session_indexes)
            assert await RolePermission.find_one(RolePermission.role_id == role_ids["analyst"],
                                                 RolePermission.permission_id == str(assign_permission.id)) is not None
            assert await RolePermission.find_one(RolePermission.role_id == role_ids["reviewer"],
                                                 RolePermission.permission_id == str(create_permission.id)) is None
            async def create_user(name, role):
                data = expect(await api.post("/users", headers=admin, json={
                    "name": name, "email": f"{name}@example.org", "password": "TestPass123!",
                    "role_id": role_ids[role]}), 201)
                token = expect(await api.post("/auth/login", json={
                    "email": data["email"], "password": "TestPass123!"}), 200)["access_token"]
                return data, auth(token)

            analyst_user, analyst = await create_user("analyst", "analyst")
            reviewer_user, reviewer = await create_user("reviewer", "reviewer")
            analyst_access = expect(await api.get("/users/me/access", headers=analyst), 200)
            reviewer_access = expect(await api.get("/users/me/access", headers=reviewer), 200)
            assert "tag:create" in analyst_access["permissions"] and "tag:assign" in analyst_access["permissions"]
            assert "tag:assign" in reviewer_access["permissions"] and "tag:create" not in reviewer_access["permissions"]
            case_a = expect(await api.post("/cases", headers=analyst, json={
                "case_number": "CV-A", "case_type": "Digital"}), 201)
            case_b = expect(await api.post("/cases", headers=analyst, json={
                "case_number": "CV-B", "case_type": "Digital"}), 201)
            case_c = expect(await api.post("/cases", headers=admin, json={
                "case_number": "CV-C", "case_type": "Digital"}), 201)
            await db.cases.update_one({"_id": ObjectId(case_a["id"])},
                                      {"$set": {"submission_date": datetime(2026, 10, 16, 0, 0)}})
            await db.cases.update_one({"_id": ObjectId(case_b["id"])},
                                      {"$set": {"submission_date": datetime(2026, 10, 17, 0, 0)}})
            await db.cases.update_one({"_id": ObjectId(case_c["id"])},
                                      {"$set": {"submission_date": datetime(2026, 10, 16, 23, 59, 59)}})
            found = expect(await api.get("/cases", headers=analyst, params={
                "analyst_id": analyst_user["id"], "submitted_from": "2026-10-16",
                "submitted_to": "2026-10-16", "status": "open", "case_type": "Digital",
                "q": "CV-"}), 200)
            assert [item["id"] for item in found] == [case_a["id"]]
            expect(await api.get("/cases", headers=admin, params={
                "submitted_from": "2026-10-17", "submitted_to": "2026-10-16"}), 422)

            for headers in (admin, analyst, reviewer):
                assert expect(await api.get("/tags", headers=headers), 200) == []
            expect(await api.post("/tags", headers=reviewer, json={"name": "lab-review"}), 403)
            tag = expect(await api.post("/tags", headers=analyst, json={"name": " lab-review "}), 201)
            second_tag = expect(await api.post("/tags", headers=admin, json={"name": "needs-review"}), 201)
            assert tag["name"] == "lab-review"
            duplicate_name = expect(await api.post("/tags", headers=analyst,
                                                   json={"name": "lab-review"}), 409)
            assert "already exists" in duplicate_name["detail"]
            expect(await api.post("/tags", headers=analyst, json={"name": "  "}), 422)
            expect(await api.post(f"/cases/{case_a['id']}/tags", headers=analyst,
                                  json={"tag_id": tag["id"]}), 201)
            duplicate_link = expect(await api.post(f"/cases/{case_a['id']}/tags", headers=reviewer,
                                                   json={"tag_id": tag["id"]}), 409)
            assert "already assigned" in duplicate_link["detail"]
            expect(await api.post(f"/cases/{case_a['id']}/tags", headers=admin,
                                  json={"tag_id": second_tag["id"]}), 201)
            expect(await api.post(f"/cases/{case_b['id']}/tags", headers=reviewer,
                                  json={"tag_id": tag["id"]}), 201)
            assert {item["id"] for item in expect(await api.get(f"/cases/{case_a['id']}/tags",
                                                         headers=analyst), 200)} == {tag["id"], second_tag["id"]}
            expect(await api.delete(f"/cases/{case_a['id']}/tags/{tag['id']}", headers=analyst), 204)
            assert [item["id"] for item in expect(await api.get(f"/cases/{case_a['id']}/tags",
                                                          headers=analyst), 200)] == [second_tag["id"]]
            assert [item["id"] for item in expect(await api.get(f"/cases/{case_b['id']}/tags",
                                                          headers=reviewer), 200)] == [tag["id"]]
            expect(await api.delete(f"/cases/{case_a['id']}/tags/{second_tag['id']}", headers=reviewer), 204)
            expect(await api.delete(f"/cases/{case_b['id']}/tags/{tag['id']}", headers=admin), 204)
            assert expect(await api.get(f"/cases/{case_a['id']}/tags", headers=analyst), 200) == []
            assert {item["id"] for item in expect(await api.get("/tags", headers=admin), 200)} == {tag["id"], second_tag["id"]}
            tag_audits = await AuditTransaction.find({"action": {"$in": ["tag_assigned", "tag_removed"]}}).to_list()
            assert len(tag_audits) == 6
            assert any(entry.action == "tag_assigned" and entry.actor_user_id == analyst_user["id"]
                       and entry.case_id == case_a["id"] and entry.metadata["tag_id"] == tag["id"]
                       and entry.occurred_at for entry in tag_audits)
            assert any(entry.action == "tag_removed" and entry.actor_user_id == analyst_user["id"]
                       and entry.case_id == case_a["id"] and entry.metadata["tag_id"] == tag["id"]
                       and entry.occurred_at for entry in tag_audits)
            assert any(entry.action == "tag_removed" and entry.actor_user_id == reviewer_user["id"]
                       and entry.case_id == case_a["id"] and entry.metadata["tag_id"] == second_tag["id"]
                       and entry.occurred_at for entry in tag_audits)
            assert any(entry.action == "tag_removed" and entry.actor_user_id == access["id"]
                       and entry.case_id == case_b["id"]
                       and entry.metadata["tag_id"] == tag["id"] and entry.occurred_at for entry in tag_audits)
            assert all(entry.actor_user_id and entry.case_id and entry.metadata["tag_id"]
                       and entry.occurred_at for entry in tag_audits)
            expect(await api.delete(f"/tags/{tag['id']}", headers=analyst), 403)
            expect(await api.delete(f"/tags/{tag['id']}", headers=reviewer), 403)
            expect(await api.post(f"/cases/{case_a['id']}/tags", headers=analyst,
                                  json={"tag_id": tag["id"]}), 201)
            expect(await api.post(f"/cases/{case_b['id']}/tags", headers=reviewer,
                                  json={"tag_id": tag["id"]}), 201)
            expect(await api.delete(f"/tags/{tag['id']}", headers=admin), 204)
            assert [item["id"] for item in expect(await api.get("/tags", headers=analyst), 200)] == [second_tag["id"]]
            assert expect(await api.get(f"/cases/{case_a['id']}/tags", headers=admin), 200) == []
            assert expect(await api.get(f"/cases/{case_b['id']}/tags", headers=admin), 200) == []
            expect(await api.post(f"/cases/{case_a['id']}/tags", headers=admin,
                                  json={"tag_id": tag["id"]}), 404)
            expect(await api.delete(f"/tags/{tag['id']}", headers=admin), 404)
            deleted_audits = await AuditTransaction.find({"action": "tag_deleted"}).to_list()
            assert len(deleted_audits) == 1
            assert deleted_audits[0].actor_user_id == access["id"]
            assert deleted_audits[0].metadata["tag_id"] == tag["id"]
            assert deleted_audits[0].metadata["removed_assignments"] == 2
            removal_audits = await AuditTransaction.find({"action": "tag_removed",
                                                          "metadata.tag_id": tag["id"]}).to_list()
            assert {entry.case_id for entry in removal_audits} == {case_a["id"], case_b["id"]}
            assert len(removal_audits) == 4
            expect(await api.patch(f"/cases/{case_a['id']}", headers=analyst,
                                   json={"status": "closed"}), 403)
            expect(await api.patch(f"/cases/{case_a['id']}", headers=reviewer,
                                   json={"status": "closed"}), 200)
            expect(await api.delete(f"/cases/{case_a['id']}", headers=analyst), 403)
            expect(await api.delete(f"/cases/{case_a['id']}", headers=reviewer), 403)

            file = pdf_bytes()
            def upload(data=file, name="report.pdf"):
                return {"file": (name, data, "application/pdf")}
            denied_upload = await api.post("/evidence", headers=reviewer,
                                           data={"case_id": case_a["id"], "evidence_type": "Log",
                                                 "title": "Initial report"}, files=upload())
            assert "evidence:upload" in expect(denied_upload, 403)["detail"]
            assert not await Evidence.find_all().count()
            expect(await api.post("/evidence", headers=analyst,
                                  data={"case_id": case_a["id"], "evidence_type": "L",
                                        "title": "Initial report"}, files=upload()), 422)
            expect(await api.post("/evidence", headers=analyst,
                                  data={"case_id": case_a["id"], "evidence_type": "Log",
                                        "title": "X" * 256}, files=upload()), 422)
            expect(await api.post("/evidence", headers=analyst,
                                  data={"case_id": case_a["id"], "evidence_type": "Log",
                                        "title": "Initial report"},
                                  files=upload(b"%PDF-1.7\ninvalid")), 400)
            assert await db.fs.files.count_documents({}) == 0
            item = expect(await api.post("/evidence", headers=analyst,
                                         data={"case_id": case_a["id"], "evidence_type": "Log",
                                               "title": "Initial report", "description": "Saved description",
                                               "source_device": "Lab laptop", "notes": "Review copy"}, files=upload()), 201)
            assert item["case_id"] == case_a["id"]
            assert item["id"] in [entry["id"] for entry in expect(
                await api.get(f"/evidence/by-case/{case_a['id']}", headers=analyst), 200)]
            assert item["id"] not in [entry["id"] for entry in expect(
                await api.get(f"/evidence/by-case/{case_b['id']}", headers=analyst), 200)]
            assert item["description"] == "Saved description"
            assert item["source_device"] == "Lab laptop" and item["notes"] == "Review copy"
            evidence_id = item["id"]
            first = (await EvidenceVersion.find(EvidenceVersion.evidence_id == evidence_id).to_list())[0]
            version_id = str(first.id)
            status_path = f"/evidence/{evidence_id}/versions/{version_id}/verification-status"
            initial_status = expect(await api.get(status_path, headers=reviewer), 200)
            assert initial_status["status"] == "Not checked" and initial_status["checked_at"] is None
            expect(await api.get(status_path), 403)
            original_download = await api.get(f"/evidence/{evidence_id}/versions/{version_id}/download",
                                              headers=reviewer)
            assert original_download.status_code == 200 and original_download.content == file
            assert expect(await api.get(f"/evidence/{evidence_id}/versions/{version_id}/verify",
                                        headers=reviewer), 200)["intact"] is True
            checked_status = expect(await api.get(status_path, headers=reviewer), 200)
            assert checked_status["status"] == "Intact" and checked_status["checked_at"]
            assert checked_status["actor_user_id"] == reviewer_user["id"]
            chunk = await db.fs.chunks.find_one({"files_id": ObjectId(first.storage_path)})
            changed = bytearray(chunk["data"])
            changed[0] = ord("X")
            await db.fs.chunks.update_one({"_id": chunk["_id"]}, {"$set": {"data": bytes(changed)}})
            check = expect(await api.get(f"/evidence/{evidence_id}/versions/{version_id}/verify",
                                         headers=reviewer), 200)
            assert check["intact"] is False and check["is_tamper_flagged"] is True
            assert expect(await api.get(status_path, headers=reviewer), 200)["status"] == "Mismatch detected"
            modified_download = await api.get(f"/evidence/{evidence_id}/versions/{version_id}/download",
                                              headers=reviewer)
            assert modified_download.status_code == 200
            assert modified_download.content != file and modified_download.content[0] == ord("X")
            assert await AuditTransaction.find(AuditTransaction.action == "tamper_flagged").count() == 1

            # An unavailable stored file is a failed attempt, never a completed comparison.
            verified_before = await AuditTransaction.find(AuditTransaction.action == "evidence_verified").count()
            missing_path = str(ObjectId())
            await db.evidence_versions.update_one({"_id": first.id}, {"$set": {"storage_path": missing_path}})
            try:
                failure = expect(await api.get(f"/evidence/{evidence_id}/versions/{version_id}/verify",
                                               headers=reviewer), 503)
                assert "could not be read" in failure["detail"]
                assert await AuditTransaction.find(AuditTransaction.action == "evidence_verified").count() == verified_before
                assert (await EvidenceVersion.get(version_id)).is_tamper_flagged is True
                assert expect(await api.get(status_path, headers=reviewer), 200)["status"] == "Check failed"
                latest = expect(await api.get("/audit/integrity/latest", headers=admin), 200)
                assert latest["action"] == "evidence_verification_failed"
                assert latest["evidence_id"] == evidence_id and latest["metadata"]["version_id"] == version_id
                expect(await api.get("/audit/integrity/latest", headers=analyst), 403)
            finally:
                await db.evidence_versions.update_one({"_id": first.id},
                                                     {"$set": {"storage_path": first.storage_path}})

            original_insert = AuditTransaction.insert
            async def failing_insert(self, *args, **kwargs):
                if self.action == "evidence_version_added":
                    raise RuntimeError("deliberate audit failure")
                return await original_insert(self, *args, **kwargs)
            before_files = await db.fs.files.count_documents({})
            with monkeypatch.context() as patch:
                patch.setattr(AuditTransaction, "insert", failing_insert)
                with pytest.raises(RuntimeError, match="deliberate audit failure"):
                    await api.post(f"/evidence/{evidence_id}/versions", headers=analyst,
                                   files=upload())
            assert await db.fs.files.count_documents({}) == before_files
            assert await EvidenceVersion.find(EvidenceVersion.evidence_id == evidence_id).count() == 1
            assert (await Evidence.get(evidence_id)).current_version_id == version_id
            assert (await Evidence.get(evidence_id)).next_version_no == 2

            responses = await asyncio.gather(*[
                api.post(f"/evidence/{evidence_id}/versions", headers=analyst, files=upload())
                for _ in range(2)])
            numbers = sorted(expect(response, 201)["version_no"] for response in responses)
            assert numbers == [2, 3]
            assert await EvidenceVersion.find(EvidenceVersion.evidence_id == evidence_id).count() == 3
            assert await db.fs.files.count_documents({}) == 3
            assert await AuditTransaction.find(AuditTransaction.action == "evidence_version_added").count() == 2

            expect(await api.get(f"/evidence/by-case/{case_a['id']}", headers=analyst), 200)
            expect(await api.get(f"/evidence/{evidence_id}", headers=analyst), 200)
            expect(await api.get(f"/evidence/{evidence_id}/versions", headers=analyst), 200)
            expect(await api.get(f"/evidence/{evidence_id}/versions/{version_id}/download",
                                 headers=analyst), 200)
            expect(await api.patch("/users/me/password", headers=analyst, json={
                "current_password": "TestPass123!", "new_password": "NewTestPass123!"}), 204)
            logs = expect(await api.get("/audit", headers=admin), 200)
            actions = {entry["action"] for entry in logs}
            assert {"cases_listed", "evidence_listed", "evidence_viewed", "versions_listed",
                    "evidence_downloaded", "tag_created", "tag_assigned", "tag_removed",
                    "password_changed"} <= actions
            log_text = str(logs)
            assert "TestPass123!" not in log_text and "NewTestPass123!" not in log_text
            assert admin_token not in log_text and file[:50].hex() not in log_text

            expect(await api.delete(f"/evidence/{evidence_id}", headers=analyst), 403)
            expect(await api.delete(f"/evidence/{evidence_id}", headers=reviewer), 403)
            expect(await api.delete(f"/evidence/{evidence_id}", headers=admin), 204)
            assert (await Evidence.get(evidence_id)).deleted_at is not None
            assert await db.fs.files.count_documents({}) == 3
            for method, path in [
                ("get", f"/evidence/{evidence_id}"),
                ("get", f"/evidence/{evidence_id}/versions"),
                ("get", f"/evidence/{evidence_id}/versions/{version_id}/download"),
                ("get", f"/evidence/{evidence_id}/versions/{version_id}/verify"),
            ]:
                expect(await getattr(api, method)(path, headers=admin), 404)
            expect(await api.post(f"/evidence/{evidence_id}/versions", headers=admin,
                                  files=upload()), 404)
            expect(await api.get(f"/evidence/deleted/{evidence_id}", headers=admin), 200)
            expect(await api.get(f"/evidence/deleted/{evidence_id}", headers=analyst), 403)
            expect(await api.delete(f"/cases/{case_a['id']}", headers=admin), 204)
            assert await db.cases.count_documents({"_id": ObjectId(case_a["id"])}) == 1
            active_case_ids = [entry["id"] for entry in expect(await api.get("/cases", headers=analyst), 200)]
            assert case_a["id"] not in active_case_ids and case_b["id"] in active_case_ids
            assert await db.evidence_versions.count_documents({"evidence_id": evidence_id}) == 3
            expect(await api.get(f"/evidence/by-case/{case_a['id']}", headers=admin), 404)
            expect(await api.get(f"/cases/deleted/{case_a['id']}", headers=admin), 200)
            assert await AuditTransaction.find(AuditTransaction.action == "case_deleted").count() == 1
            assert await AuditTransaction.find(AuditTransaction.action == "evidence_deleted").count() == 1

            still_active = expect(await api.post("/evidence", headers=analyst,
                                                 data={"case_id": case_b["id"], "evidence_type": "Log",
                                                       "title": "Parent deletion check"}, files=upload()), 201)
            expect(await api.delete(f"/cases/{case_b['id']}", headers=admin), 204)
            assert (await Evidence.get(still_active["id"])).deleted_at is None
            expect(await api.get(f"/evidence/{still_active['id']}", headers=admin), 404)
            expect(await api.get(f"/evidence/by-case/{case_b['id']}", headers=admin), 404)
            expect(await api.post(f"/evidence/{still_active['id']}/versions", headers=admin,
                                  files=upload()), 404)
            expect(await api.get(f"/evidence/deleted/{still_active['id']}", headers=admin), 200)
            expect(await api.post("/auth/logout", headers=analyst), 204)
            expect(await api.get("/users/me/access", headers=analyst), 401)
            resumed_analyst = expect(await api.post("/auth/login", json={
                "email": analyst_user["email"], "password": "NewTestPass123!"}), 200)
            assert expect(await api.get("/users/me", headers=auth(resumed_analyst["access_token"])), 200)["id"] == analyst_user["id"]

            paused_user, paused_token = await create_user("paused", "analyst")
            expect(await api.delete(f"/users/{paused_user['id']}", headers=admin), 405)
            assert (await User.get(paused_user["id"])).is_active is True
            assert (await User.get(paused_user["id"])).deleted_at is None
            expect(await api.patch(f"/users/{paused_user['id']}", headers=admin,
                                   json={"is_active": False}), 200)
            assert await db.active_sessions.find_one({"_id": paused_user["id"]}) is None
            expect(await api.get("/users/me", headers=paused_token), 403)
            expect(await api.patch(f"/users/{paused_user['id']}", headers=admin,
                                   json={"is_active": True}), 200)
            expect(await api.get("/users/me", headers=paused_token), 401)
            expect(await api.post("/auth/login", json={
                "email": paused_user["email"], "password": "TestPass123!"}), 200)

            race_user = expect(await api.post("/users", headers=admin, json={
                "name": "Race User", "email": "race@example.org", "password": "TestPass123!",
                "role_id": role_ids["analyst"]}), 201)
            race_credentials = {"email": race_user["email"], "password": "TestPass123!"}
            race_results = await asyncio.gather(
                api.post("/auth/login", json=race_credentials),
                api.post("/auth/login", json=race_credentials))
            assert sorted(result.status_code for result in race_results) == [200, 409]
            first_token = next(result.json()["access_token"] for result in race_results if result.status_code == 200)
            assert expect(await api.get("/users/me", headers=auth(first_token)), 200)["id"] == race_user["id"]
            assert await db.active_sessions.count_documents({"_id": race_user["id"]}) == 1

            await db.active_sessions.update_one({"_id": race_user["id"]},
                                                {"$set": {"last_seen_at": datetime.utcnow() - SESSION_LEASE + timedelta(seconds=30)}})
            expect(await api.post("/auth/heartbeat", headers=auth(first_token)), 204)
            renewed = await db.active_sessions.find_one({"_id": race_user["id"]})
            assert renewed["last_seen_at"] > datetime.utcnow() - timedelta(seconds=30)
            expect(await api.post("/auth/login", json=race_credentials), 409)

            await db.active_sessions.update_one({"_id": race_user["id"]},
                                                {"$set": {"last_seen_at": datetime.utcnow() - SESSION_LEASE - timedelta(seconds=1)}})
            expect(await api.post("/auth/heartbeat", headers=auth(first_token)), 401)
            lease_replacement = expect(await api.post("/auth/login", json=race_credentials), 200)
            expect(await api.get("/users/me", headers=auth(first_token)), 401)
            assert expect(await api.get("/users/me", headers=auth(lease_replacement["access_token"])), 200)["id"] == race_user["id"]

            await db.active_sessions.update_one({"_id": race_user["id"]},
                                                {"$set": {"expires_at": datetime.utcnow() - timedelta(seconds=1)}})
            replacement = expect(await api.post("/auth/login", json=race_credentials), 200)
            expect(await api.get("/users/me", headers=auth(lease_replacement["access_token"])), 401)
            expect(await api.get("/users/me", headers=auth(replacement["access_token"])), 200)
            expect(await api.post("/auth/logout", headers=auth(replacement["access_token"])), 204)
            legacy_token = expect(await api.post("/auth/login", json=race_credentials), 200)["access_token"]
            await db.active_sessions.update_one({"_id": race_user["id"]},
                                                {"$unset": {"last_seen_at": ""},
                                                 "$set": {"started_at": datetime.utcnow() - SESSION_LEASE - timedelta(seconds=1)}})
            expect(await api.get("/users/me", headers=auth(legacy_token)), 401)
            expect(await api.post("/auth/login", json=race_credentials), 200)
    finally:
        cleanup_client = client or database_module._client
        try:
            if cleanup_client is not None:
                await cleanup_client.drop_database(test_db)
        finally:
            if cleanup_client is not None:
                cleanup_client.close()
            settings.MONGO_URI, settings.DB_NAME = original_uri, original_db
            database_module._client = None


@pytest.mark.skipif(not os.environ.get("TEST_MONGO_URI"), reason="TEST_MONGO_URI not set; no isolated MongoDB test target")
def test_full_backend_against_transaction_capable_mongo(monkeypatch):
    asyncio.run(exercise_database(monkeypatch))

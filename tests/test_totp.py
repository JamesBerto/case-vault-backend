"""TOTP checks use temporary users and a new cv_test_* database, never application data."""
import asyncio
import base64
import os
from datetime import datetime, timedelta
from uuid import uuid4

import httpx
import pyotp
import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import ValidationError

from app.core import database
from app.core.config import settings
from app.main import app
from app.routers import auth
from app.schemas.auth import TotpVerifyRequest
from app.services import totp_service
from app.services.seed_service import run_seed


def test_totp_drift_and_invalid_codes():
    secret = pyotp.random_base32()
    now = 1_800_000_000
    step = now // 30
    for offset in (-1, 0, 1):
        assert totp_service.matching_step(secret, pyotp.TOTP(secret).at(now + offset * 30), now) == step + offset
    for server_time in (now + 29, now + 30):
        for offset in (-1, 0, 1):
            expected_step = server_time // 30 + offset
            code = pyotp.TOTP(secret).at(expected_step * 30)
            assert totp_service.matching_step(secret, code, server_time) == expected_step
    assert totp_service.matching_step(secret, pyotp.TOTP(secret).at(now - 90), now) is None
    for code in ("12345", "1234567", "abcdef", "１２３４５６"):
        with pytest.raises(ValidationError):
            TotpVerifyRequest(challenge="test." + "a" * 32, code=code)


def test_totp_encryption_and_qr(monkeypatch):
    monkeypatch.setattr(settings, "TOTP_ENCRYPTION_KEY", Fernet.generate_key().decode())
    secret = pyotp.random_base32()
    encrypted = totp_service.cipher().encrypt(secret.encode()).decode()
    assert secret not in encrypted and totp_service.decrypt_secret(encrypted) == secret
    setup = totp_service.setup_details(secret, "test@casevault.org")
    assert pyotp.parse_uri(setup["uri"]).secret == secret
    assert base64.b64decode(setup["qr_image"].split(",")[1]).startswith(b"\x89PNG\r\n\x1a\n")
    monkeypatch.setattr(settings, "TOTP_ENCRYPTION_KEY", Fernet.generate_key().decode())
    with pytest.raises(HTTPException) as error:
        totp_service.decrypt_secret(encrypted)
    assert error.value.status_code == 503
    monkeypatch.setattr(settings, "TOTP_ENCRYPTION_KEY", "")
    with pytest.raises(HTTPException) as error:
        totp_service.cipher()
    assert error.value.status_code == 503


def expect(response, status):
    assert response.status_code == status, response.text
    return response.json() if response.content and response.headers.get("content-type", "").startswith("application/json") else response


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.skipif(not os.environ.get("TEST_MONGO_URI"), reason="TEST_MONGO_URI transaction-capable test replica set required")
def test_totp_database_flow(monkeypatch):
    asyncio.run(exercise_totp(monkeypatch))


async def exercise_totp(monkeypatch):
    uri = os.environ["TEST_MONGO_URI"]
    probe = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
    try:
        assert (await probe.admin.command("hello")).get("setName"), "Test replica set required"
    finally:
        probe.close()
    test_name = "cv_test_totp_" + uuid4().hex[:20]
    assert test_name != settings.DB_NAME
    monkeypatch.setattr(settings, "MONGO_URI", uri)
    monkeypatch.setattr(settings, "DB_NAME", test_name)
    monkeypatch.setattr(settings, "TOTP_ENCRYPTION_KEY", Fernet.generate_key().decode())
    clock = [datetime.now().timestamp()]
    original_matching = totp_service.matching_step
    monkeypatch.setattr(totp_service, "matching_step", lambda secret, code: original_matching(secret, code, clock[0]))
    code_for = lambda secret: pyotp.TOTP(secret).at(clock[0])
    try:
        await run_seed()
        db = database.get_client()[test_name]
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as api:
            admin_credentials = {"email": "admin@casevault.org", "password": "ChangeMe123!"}
            enrollment_response = await api.post("/auth/login", json=admin_credentials)
            enrollment = expect(enrollment_response, 202)
            assert enrollment_response.headers["Cache-Control"] == "no-store"
            assert enrollment["status"] == "totp_setup_required" and "access_token" not in enrollment
            admin_secret = enrollment["setup"]["secret"]
            admin_record = await db.users.find_one({"email": admin_credentials["email"]})
            assert not admin_record["totp_enabled"]
            assert admin_record["totp_pending_secret_encrypted"] != admin_secret
            assert await db.active_sessions.count_documents({}) == 0
            admin_id = str(admin_record["_id"])

            verified = expect(await api.post("/auth/totp/verify", json={
                "challenge": enrollment["challenge"], "code": code_for(admin_secret)}), 200)
            admin = bearer(verified["access_token"])
            assert expect(await api.get("/users/me", headers=admin), 200)["totp_enabled"]
            expect(await api.post("/auth/totp/verify", json={
                "challenge": enrollment["challenge"], "code": code_for(admin_secret)}), 401)
            roles = expect(await api.get("/roles", headers=admin), 200)
            analyst_role = next(item["id"] for item in roles if item["name"] == "analyst")
            created = expect(await api.post("/users", headers=admin, json={"name": "TOTP Test",
                "email": "totp@casevault.org", "password": "TestPass123!", "role_id": analyst_role}), 201)
            user_id = created["id"]
            credentials = {"email": created["email"], "password": "TestPass123!"}
            normal = expect(await api.post("/auth/login", json=credentials), 200)
            analyst = bearer(normal["access_token"])
            expect(await api.post(f"/users/{admin_id}/totp/setup", headers=analyst), 403)
            expect(await api.post(f"/users/{user_id}/totp/reset", headers=analyst), 403)
            custom_role = await db.roles.insert_one({"name": "Custom Manager", "description": "Test only"})
            manage_permission = await db.permissions.find_one({"code": "user:manage"})
            await db.role_permissions.insert_one({"role_id": str(custom_role.inserted_id),
                                                  "permission_id": str(manage_permission["_id"])})
            custom_user = expect(await api.post("/users", headers=admin, json={"name": "Custom Manager",
                "email": "custom@casevault.org", "password": "TestPass123!", "role_id": str(custom_role.inserted_id)}), 201)
            custom_login = expect(await api.post("/auth/login", json={"email": custom_user["email"], "password": "TestPass123!"}), 200)
            custom_auth = bearer(custom_login["access_token"])
            expect(await api.post(f"/users/{user_id}/totp/setup", headers=custom_auth), 403)
            expect(await api.post(f"/users/{user_id}/totp/reset", headers=custom_auth), 403)
            setup = expect(await api.post(f"/users/{user_id}/totp/setup", headers=admin), 200)
            secret = setup["secret"]
            profile = expect(await api.get("/users/me", headers=analyst), 200)
            assert profile["totp_pending"] and not profile["totp_enabled"]
            assert "secret" not in str(profile) and secret not in str(profile)
            expect(await api.post("/auth/totp/verify", json={"challenge": setup["challenge"], "code": code_for(secret)}), 401)
            expect(await api.post(f"/users/{admin_id}/totp/confirm", headers=admin,
                json={"challenge": setup["challenge"], "code": code_for(secret)}), 401)
            original_totp_log = totp_service.log_action
            async def fail_activation_audit(*args, **kwargs):
                if args[1] == "totp_enabled":
                    raise RuntimeError("Injected activation audit failure")
                return await original_totp_log(*args, **kwargs)
            monkeypatch.setattr(totp_service, "log_action", fail_activation_audit)
            expect(await api.post(f"/users/{user_id}/totp/confirm", headers=admin,
                json={"challenge": setup["challenge"], "code": code_for(secret)}), 500)
            assert not expect(await api.get("/users/me", headers=analyst), 200)["totp_enabled"]
            assert await db.active_sessions.find_one({"_id": user_id}) is not None
            monkeypatch.setattr(totp_service, "log_action", original_totp_log)
            enabled = expect(await api.post(f"/users/{user_id}/totp/confirm", headers=admin,
                json={"challenge": setup["challenge"], "code": code_for(secret)}), 200)
            assert enabled["totp_enabled"] and not enabled["totp_pending"]
            expect(await api.get("/users/me", headers=analyst), 401)

            challenge = expect(await api.post("/auth/login", json=credentials), 202)
            assert challenge["status"] == "totp_required" and challenge["setup"] is None
            replay = expect(await api.post("/auth/totp/verify", json={"challenge": challenge["challenge"], "code": code_for(secret)}), 400)
            assert replay["detail"] == "Authenticator code already used; wait for the next code"
            clock[0] += 30
            original_log = auth.log_action
            async def fail_login_audit(*args, **kwargs):
                raise RuntimeError("Injected audit failure")
            monkeypatch.setattr(auth, "log_action", fail_login_audit)
            expect(await api.post("/auth/totp/verify", json={"challenge": challenge["challenge"], "code": code_for(secret)}), 500)
            assert await db.active_sessions.find_one({"_id": user_id}) is None
            after_rollback = await db.users.find_one({"email": credentials["email"]})
            assert after_rollback["totp_last_used_step"] == int(clock[0] - 30) // 30
            assert await db.totp_challenges.find_one({"_id": user_id}) is not None
            monkeypatch.setattr(auth, "log_action", original_log)
            concurrent = await asyncio.gather(*[
                api.post("/auth/totp/verify", json={"challenge": challenge["challenge"], "code": code_for(secret)})
                for _ in range(2)])
            assert sorted(item.status_code for item in concurrent)[0] == 200
            assert sum(item.status_code == 200 for item in concurrent) == 1
            analyst = bearer(next(item.json()["access_token"] for item in concurrent if item.status_code == 200))
            assert await db.active_sessions.count_documents({"_id": user_id}) == 1
            replacement = expect(await api.post(f"/users/{user_id}/totp/setup", headers=admin), 200)
            pending_record = await db.users.find_one({"email": credentials["email"]})
            assert pending_record["totp_enabled"]
            assert totp_service.decrypt_secret(pending_record["totp_secret_encrypted"]) == secret
            assert replacement["secret"] != secret
            assert expect(await api.get("/users/me", headers=analyst), 200)["totp_pending"]
            expect(await api.post("/auth/logout", headers=analyst), 204)

            challenge = expect(await api.post("/auth/login", json=credentials), 202)
            for _ in range(5):
                expect(await api.post("/auth/totp/verify", json={"challenge": challenge["challenge"], "code": "invalid"}), 422)
            invalid_code = next(f"{number:06d}" for number in range(10)
                                if original_matching(secret, f"{number:06d}", clock[0]) is None)
            for attempt in range(5):
                if attempt == 2:
                    challenge = expect(await api.post("/auth/login", json=credentials), 202)
                invalid = expect(await api.post("/auth/totp/verify", json={"challenge": challenge["challenge"], "code": invalid_code}), 400)
                assert invalid["detail"] == "Invalid or expired code"
            expect(await api.post("/auth/login", json=credentials), 429)
            await db.totp_challenges.update_one({"_id": user_id}, {"$set": {"expires_at": datetime.utcnow() - timedelta(seconds=1)}})
            expect(await api.post("/auth/totp/verify", json={"challenge": challenge["challenge"], "code": code_for(secret)}), 401)
            assert expect(await api.post("/auth/login", json=credentials), 202)["status"] == "totp_required"

            reset = expect(await api.post(f"/users/{user_id}/totp/reset", headers=admin), 200)
            assert not reset["totp_enabled"] and not reset["totp_pending"]
            expect(await api.post("/auth/login", json=credentials), 200)
            expect(await api.post("/auth/logout", headers=admin), 204)
            clock[0] += 30
            admin_challenge = expect(await api.post("/auth/login", json=admin_credentials), 202)
            assert admin_challenge["status"] == "totp_required"
            admin = bearer(expect(await api.post("/auth/totp/verify", json={
                "challenge": admin_challenge["challenge"], "code": code_for(admin_secret)}), 200)["access_token"])
            expect(await api.post(f"/users/{admin_id}/totp/reset", headers=admin), 200)
            expect(await api.get("/users/me", headers=admin), 403)
            assert expect(await api.post("/auth/login", json=admin_credentials), 202)["status"] == "totp_setup_required"
            actions = await db.audit_transactions.find({"action": {"$in": [
                "totp_enabled", "totp_reset", "totp_check_failed", "totp_setup_started"]}}).to_list(None)
            assert {item["action"] for item in actions} == {
                "totp_enabled", "totp_reset", "totp_check_failed", "totp_setup_started"}
            assert all(item["actor_user_id"] and item["occurred_at"] and item["metadata"]["target"] for item in actions)
            assert secret not in str(actions) and admin_secret not in str(actions)
            assert credentials["password"] not in str(actions) and verified["access_token"] not in str(actions)
    finally:
        if database._client is not None:
            await database._client.drop_database(test_name)
            database._client.close()
            database._client = None

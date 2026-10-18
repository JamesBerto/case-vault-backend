import asyncio
import io
from datetime import date, datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, UploadFile
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from pypdf import PdfWriter

from app.routers import audit, cases, evidence, users
from app.core.password_policy import is_common_password
from app.core.security import hash_password, pwd_context, verify_password
from app.services import session_service
from app.schemas.user import ChangePasswordRequest, UserCreate
from app.main import safe_validation_error


def pdf_bytes():
    output = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.write(output)
    return output.getvalue()


def test_pdf_parser_rejects_malformed_content():
    valid = UploadFile(filename="report.pdf", file=io.BytesIO(), headers={"content-type": "application/pdf"})
    evidence._validate_pdf(valid, pdf_bytes())
    with pytest.raises(HTTPException) as error:
        evidence._validate_pdf(valid, b"%PDF-1.7\nnot a PDF")
    assert error.value.status_code == 400


def test_combined_case_filters_use_creator_and_utc_day_bounds(monkeypatch):
    captured = {}

    class Finder:
        def __init__(self, query):
            captured.update(query)

        async def to_list(self):
            return []

    monkeypatch.setattr(cases.Case, "find", lambda query: Finder(query))

    async def log(*args, **kwargs):
        captured["audit"] = (args, kwargs)

    monkeypatch.setattr(cases, "log_action", log)
    user = SimpleNamespace(id="actor")
    result = asyncio.run(cases.list_cases(
        status="open", case_type="Digital", q="CV-01", analyst_id="analyst-id",
        submitted_from=date(2026, 10, 16), submitted_to=date(2026, 10, 16),
        current_user=user))
    assert result == []
    assert captured["created_by"] == "analyst-id"
    assert captured["submission_date"] == {
        "$gte": datetime(2026, 10, 16), "$lt": datetime(2026, 10, 17)}
    assert captured["status"] == "open"
    assert captured["case_type"] == "Digital"
    assert captured["case_number"]["$regex"] == "CV\\-01"
    assert "CV-01" not in str(captured["audit"])


def test_reversed_date_range_returns_422():
    with pytest.raises(HTTPException) as error:
        asyncio.run(cases.list_cases(
            status=None, case_type=None, q=None, analyst_id=None,
            submitted_from=date(2026, 10, 17), submitted_to=date(2026, 10, 16),
            current_user=SimpleNamespace(id="actor")))
    assert error.value.status_code == 422


def test_audit_stream_pushes_new_entries_without_logging_each_check(monkeypatch):
    entries = [SimpleNamespace(id="first", actor_user_id="actor", case_id=None,
                               evidence_id=None, action="case_created", metadata={},
                               occurred_at=datetime(2026, 10, 18, 1, 0))]
    logged = []
    presence = ["admin"]

    class Finder:
        def __init__(self):
            self.count = 500

        def sort(self, *args):
            return self

        def limit(self, count):
            self.count = count
            return self

        async def to_list(self):
            return list(reversed(entries))[:self.count]

    async def log(*args, **kwargs):
        logged.append((args, kwargs))

    async def advance(_seconds):
        entries.append(SimpleNamespace(id="second", actor_user_id="analyst", case_id="case-1",
                                       evidence_id=None, action="evidence_uploaded", metadata={},
                                       occurred_at=datetime(2026, 10, 18, 1, 1)))
        presence.append("analyst")

    async def online():
        return list(presence)

    monkeypatch.setattr(audit.AuditTransaction, "find_all", lambda: Finder())
    monkeypatch.setattr(audit, "log_action", log)
    monkeypatch.setattr(audit, "online_user_ids", online)
    monkeypatch.setattr(audit.asyncio, "sleep", advance)

    async def check():
        async def connected():
            return False

        request = SimpleNamespace(is_disconnected=connected,
                                  headers={"authorization": "Bearer test-token"})
        response = await audit.stream_audit(request, limit=500, user=SimpleNamespace(id="admin"))
        first = await anext(response.body_iterator)
        first_presence = await anext(response.body_iterator)
        second = await anext(response.body_iterator)
        second_presence = await anext(response.body_iterator)
        await response.body_iterator.aclose()
        assert '"id": "first"' in first
        assert 'event: presence' in first_presence and '"admin"' in first_presence
        assert '"id": "second"' in second
        assert '"id": "first"' in second
        assert 'event: presence' in second_presence and '"analyst"' in second_presence

    asyncio.run(check())
    assert len(logged) == 1
    assert logged[0][0] == ("admin", "audit_listed")


def test_online_user_ids_uses_current_session_lease(monkeypatch):
    captured = {}

    class Cursor:
        async def to_list(self, length):
            assert length is None
            return [{"_id": "reviewer"}, {"_id": "analyst"}]

    class Sessions:
        def find(self, query, projection):
            captured.update(query)
            assert projection == {"_id": 1}
            return Cursor()

    monkeypatch.setattr(session_service, "active_sessions", lambda: Sessions())
    assert asyncio.run(session_service.online_user_ids()) == ["analyst", "reviewer"]
    assert "$or" in captured and "expires_at" in captured


@pytest.mark.parametrize("password", [
    "password123", "P@ssw0rd123!", "Admin2026!", "qwerty123", "12345678",
    "123456789123", "abcdabcd", "aaaaaaaa",
])
def test_user_chosen_password_rejects_common_choices(password):
    assert is_common_password(password)
    with pytest.raises(ValidationError):
        ChangePasswordRequest(current_password="OldPass123!", new_password=password)


def test_password_lengths_and_admin_temporary_exception():
    temporary = {"name": "Test User", "email": "test@example.com",
                 "password": "password123", "role_id": "role-id"}
    assert UserCreate.model_validate(temporary).password == "password123"
    for length in (7, 129):
        with pytest.raises(ValidationError):
            UserCreate.model_validate({**temporary, "password": "x" * length})
        with pytest.raises(ValidationError):
            ChangePasswordRequest(current_password="old", new_password="x" * length)
    long_password = ("R4ndomPassphrase!" * 8)[:128]
    assert len(ChangePasswordRequest(current_password="old", new_password=long_password).new_password) == 128


def test_only_admin_can_set_common_temporary_password(monkeypatch):
    async def role(role_id):
        return SimpleNamespace(name="admin" if role_id == "admin-role" else "analyst")

    async def absent(_email):
        return None

    async def create(data, _actor):
        return SimpleNamespace(id="new-user", name=data.name, email=data.email,
                               role_id=data.role_id, is_active=True,
                               created_at=datetime(2026, 10, 18), updated_at=datetime(2026, 10, 18))

    monkeypatch.setattr(users.Role, "get", role)
    monkeypatch.setattr(users, "User", SimpleNamespace(email="email", find_one=absent))
    monkeypatch.setattr(users, "create_user_account", create)
    data = UserCreate(name="Test User", email="test@example.com",
                      password="password123", role_id="role-id")
    with pytest.raises(HTTPException) as error:
        asyncio.run(users.create_user(data, current_user=SimpleNamespace(role_id="custom-role")))
    assert error.value.status_code == 422
    response = asyncio.run(users.create_user(data, current_user=SimpleNamespace(role_id="admin-role")))
    assert response.name == "Test User"


def test_full_128_character_password_is_hashed_and_legacy_hashes_still_verify():
    password = "a" * 72 + "X" * 56
    digest = hash_password(password)
    assert verify_password(password, digest)
    assert not verify_password("a" * 72 + "Y" * 56, digest)
    assert verify_password("legacy-pass", pwd_context.hash("legacy-pass", scheme="bcrypt"))


def test_validation_errors_do_not_echo_submitted_password():
    error = RequestValidationError([{"loc": ("body", "new_password"),
                                     "msg": "Password is too common", "type": "value_error",
                                     "input": "password123"}])
    response = asyncio.run(safe_validation_error(None, error))
    assert response.status_code == 422
    assert b"password123" not in response.body
    assert b"Password is too common" in response.body


@pytest.mark.parametrize("field", ["name", "email", "password", "role_id"])
def test_create_user_requires_every_field(field):
    data = {"name": "Test User", "email": "test@example.com",
            "password": "TestPass123!", "role_id": "role-id"}
    data.pop(field)
    with pytest.raises(ValidationError):
        UserCreate.model_validate(data)


@pytest.mark.parametrize("field", ["name", "email", "password", "role_id"])
def test_create_user_rejects_whitespace_only_fields(field):
    data = {"name": "Test User", "email": "test@example.com",
            "password": "TestPass123!", "role_id": "role-id"}
    data[field] = "        "
    with pytest.raises(ValidationError):
        UserCreate.model_validate(data)

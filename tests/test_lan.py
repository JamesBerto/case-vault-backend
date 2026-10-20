"""LAN entry-point checks do not connect to or change MongoDB."""

import asyncio

import httpx
import pytest

from app.lan import create_app


def test_lan_serves_built_frontend_and_existing_api(tmp_path):
    (tmp_path / "index.html").write_text("<html>Case Vault LAN</html>", encoding="utf-8")
    app = create_app(subnet="192.168.8.40/24", frontend_dist=tmp_path, connect_database=False)

    async def request(path, client_ip, headers=None):
        transport = httpx.ASGITransport(app=app, client=(client_ip, 12345))
        async with httpx.AsyncClient(transport=transport, base_url="http://192.168.8.40") as api:
            return await api.get(path, headers=headers)

    page = asyncio.run(request("/", "192.168.8.10"))
    assert page.status_code == 200
    assert "Case Vault LAN" in page.text
    health = asyncio.run(request("/api/health", "192.168.8.10"))
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}
    docs = asyncio.run(request("/api/docs", "192.168.8.10"))
    assert docs.status_code == 200
    assert "/api/openapi.json" in docs.text

    outside = asyncio.run(request("/", "192.168.9.10", {"X-Forwarded-For": "192.168.8.10"}))
    assert outside.status_code == 403
    assert asyncio.run(request("/api/health", "192.168.9.10")).status_code == 403
    assert asyncio.run(request("/", "127.0.0.1")).status_code == 403


def test_lan_requires_private_subnet_and_frontend_build(tmp_path):
    (tmp_path / "index.html").write_text("ok", encoding="utf-8")
    for cidr in ("0.0.0.0/0", "8.8.8.0/24", "not-a-subnet"):
        with pytest.raises(RuntimeError):
            create_app(subnet=cidr, frontend_dist=tmp_path, connect_database=False)
    with pytest.raises(RuntimeError, match="Frontend build is missing"):
        create_app(subnet="10.0.0.0/24", frontend_dist=tmp_path / "missing", connect_database=False)

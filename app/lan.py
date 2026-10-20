"""Serve the built frontend and API from one address, limited to a LAN subnet."""

from contextlib import asynccontextmanager
from ipaddress import IPv4Network, ip_address, ip_network
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.database import init_db
from app.main import app as api_app


FRONTEND_DIST = Path(__file__).resolve().parent.parent / "case-vault-frontend" / "dist"
PRIVATE_LANS = tuple(ip_network(value) for value in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))


def _client_allowed(host: str | None, subnet: IPv4Network) -> bool:
    if not host:
        return False
    try:
        address = ip_address(host)
    except ValueError:
        return False
    if address.version == 6 and address.ipv4_mapped:
        address = address.ipv4_mapped
    return address in subnet


class LANOnly:
    """Check the socket peer, not headers supplied by the browser or a proxy."""

    def __init__(self, app, subnet: IPv4Network):
        self.app = app
        self.subnet = subnet

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            client = scope.get("client")
            if not _client_allowed(client[0] if client else None, self.subnet):
                if scope["type"] == "websocket":
                    await send({"type": "websocket.close", "code": 1008})
                else:
                    response = JSONResponse({"detail": "Available only on the configured local network"}, status_code=403)
                    await response(scope, receive, send)
                return
        await self.app(scope, receive, send)


def create_app(*, subnet: str | None = None, frontend_dist: Path | None = None,
               connect_database: bool = True) -> FastAPI:
    """Build the LAN entry point; Uvicorn calls this after the launcher sets its subnet."""
    raw_subnet = subnet or os.environ.get("CASE_VAULT_LAN_CIDR")
    if not raw_subnet:
        raise RuntimeError("Set CASE_VAULT_LAN_CIDR to the Wi-Fi subnet before starting LAN mode")
    try:
        allowed = ip_network(raw_subnet, strict=False)
    except ValueError as exc:
        raise RuntimeError("CASE_VAULT_LAN_CIDR must be a valid IPv4 subnet") from exc
    if not isinstance(allowed, IPv4Network) or not any(allowed.subnet_of(lan) for lan in PRIVATE_LANS):
        raise RuntimeError("CASE_VAULT_LAN_CIDR must be within a private Wi-Fi IPv4 subnet")

    directory = frontend_dist or FRONTEND_DIST
    if not (directory / "index.html").is_file():
        raise RuntimeError("Frontend build is missing; run npm.cmd run build in case-vault-frontend")

    @asynccontextmanager
    async def lifespan(_app):
        if connect_database:
            # Mounted FastAPI sub-apps do not run their own lifespan on startup.
            await init_db()
        yield

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(LANOnly, subnet=allowed)
    app.mount("/api", api_app)
    app.mount("/", StaticFiles(directory=directory, html=True), name="frontend")
    return app

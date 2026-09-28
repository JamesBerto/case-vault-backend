from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.database import init_db
from app.routers import auth, users, cases, evidence, audit, tags, roles

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(lifespan=lifespan)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(cases.router)
app.include_router(evidence.router)
app.include_router(audit.router)
app.include_router(tags.router)
app.include_router(roles.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
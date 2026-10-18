from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import init_db
from app.routers import auth, users, cases, evidence, tags, roles, audit

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def safe_validation_error(_, exc: RequestValidationError):
    details = [{key: error[key] for key in ("loc", "msg", "type") if key in error}
               for error in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": details})


app.add_middleware(CORSMiddleware, allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
                   allow_credentials=False, allow_methods=["GET", "POST", "PATCH", "DELETE"],
                   allow_headers=["Authorization", "Content-Type"])
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(cases.router)
app.include_router(evidence.router)
app.include_router(tags.router)
app.include_router(roles.router)
app.include_router(audit.router)

@app.get("/health")
async def health():
    return {"status": "ok"}

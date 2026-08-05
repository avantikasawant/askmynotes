"""
AskMyNotes API — application entry point.

All business logic lives in routers/. This file only:
  - Configures the FastAPI app
  - Registers middleware
  - Mounts routers
  - Provides health & startup hooks
"""
from dotenv import load_dotenv
load_dotenv()

import logging
import os
import uuid

import sentry_sdk
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from auth.db import init_db
from routers import auth, upload, ask, library, quiz, youtube, dashboard, jobs

# ── Logging ────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Sentry (error tracking — optional, skipped if DSN not set) ─────────────────

_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
        ],
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_RATE", "0.2")),
        environment=os.getenv("ENVIRONMENT", "development"),
        release=os.getenv("APP_VERSION", "dev"),
    )
    logger.info("Sentry initialised (env=%s)", os.getenv("ENVIRONMENT", "development"))

# ── App factory ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AskMyNotes API",
    version=os.getenv("APP_VERSION", "dev"),
    description="AI-powered study assistant — upload notes, ask questions, generate quizzes.",
    docs_url="/docs" if os.getenv("ENVIRONMENT") != "production" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT") != "production" else None,
)

# ── Database init ──────────────────────────────────────────────────────────────

init_db()

# ── Rate limiter ───────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ───────────────────────────────────────────────────────────────────────

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("CORS allowed origins: %s", _allowed_origins)

# ── Request ID middleware ──────────────────────────────────────────────────────

@app.middleware("http")
async def add_request_id(request: Request, call_next) -> Response:
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(ask.router)
app.include_router(library.router)
app.include_router(quiz.router)
app.include_router(youtube.router)
app.include_router(dashboard.router)
app.include_router(jobs.router)

# ── Health check ───────────────────────────────────────────────────────────────

@app.get("/health", tags=["ops"])
async def health():
    """Detailed health check — checks DB, Redis connectivity and required env vars."""
    checks: dict[str, str] = {}

    # Database connectivity
    try:
        import psycopg2
        conn = psycopg2.connect(os.getenv(
            "DATABASE_URL",
            "postgresql://askmynotes:askmynotes@localhost:5432/askmynotes",
        ))
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        checks["db"] = "ok"
    except Exception as e:
        logger.error("Health check: DB error — %s", e)
        checks["db"] = "error"

    # Redis connectivity
    try:
        from rag_pipeline import _get_redis
        r = _get_redis()
        if r and r.ping():
            checks["redis"] = "ok"
        else:
            checks["redis"] = "unavailable"
    except Exception as e:
        logger.error("Health check: Redis error — %s", e)
        checks["redis"] = "error"

    # Required environment variables
    checks["groq_api_key"] = "ok" if os.getenv("GROQ_API_KEY") else "missing"
    checks["jwt_secret"]   = "ok" if os.getenv("JWT_SECRET") else "missing"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {
        "status": overall,
        "version": os.getenv("APP_VERSION", "dev"),
        "environment": os.getenv("ENVIRONMENT", "development"),
        "checks": checks,
    }

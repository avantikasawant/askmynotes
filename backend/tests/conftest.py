"""
Pytest configuration for AskMyNotes backend tests.
Sets up environment variables and shared fixtures before any app code is imported.
"""
import os
import tempfile
import pytest

# ── Set env vars BEFORE any app imports ──────────────────────────────────────
# These override real values so tests never need real API keys
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-ci-32bytes-ok!")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key-not-real")


@pytest.fixture(scope="session")
def tmp_dir():
    """A temporary directory for test DB and ChromaDB — deleted after the test session."""
    with tempfile.TemporaryDirectory() as d:
        yield d


@pytest.fixture(scope="session")
def client(tmp_dir):
    """
    FastAPI TestClient with isolated SQLite DB and ChromaDB paths.
    The LLM and embeddings are lazy-loaded so they won't be called unless
    a test explicitly triggers them.
    """
    os.environ["DB_PATH"]    = os.path.join(tmp_dir, "test.db")
    os.environ["CHROMA_DIR"] = os.path.join(tmp_dir, "chroma")

    from fastapi.testclient import TestClient
    from main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth_token(client):
    """Register a test user and return a valid JWT token."""
    client.post("/auth/register", json={
        "name": "Test User",
        "email": "pytest@askmynotes.test",
        "password": "testpassword123",
        "mobile": "",
    })
    res = client.post("/auth/login", json={
        "email": "pytest@askmynotes.test",
        "password": "testpassword123",
    })
    return res.json()["token"]


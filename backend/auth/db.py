"""
Database layer — SQLite via Python's built-in sqlite3.

Stores user accounts, quiz attempts, activity logs and PDF file records.
Public API is identical to the PostgreSQL version so no callers change.
"""
import os
import sqlite3
import bcrypt
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DB_PATH", "askmynotes.db")


# ── Connection helper ──────────────────────────────────────────────────────────

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row          # rows behave like dicts
    conn.execute("PRAGMA journal_mode=WAL") # safe for concurrent reads
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ── Schema init ────────────────────────────────────────────────────────────────

def init_db() -> None:
    """Create all tables and indexes if they do not already exist."""
    conn = get_conn()
    cur = conn.cursor()
    statements = [
        """
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            email         TEXT UNIQUE NOT NULL,
            mobile        TEXT DEFAULT '',
            password_hash TEXT DEFAULT '',
            google_id     TEXT DEFAULT '',
            avatar_color  TEXT DEFAULT '#4F46E5',
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT NOT NULL,
            score      INTEGER NOT NULL,
            total      INTEGER NOT NULL,
            topic      TEXT DEFAULT 'General',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS activity_log (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT NOT NULL,
            action     TEXT NOT NULL,
            detail     TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS pdf_files (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email     TEXT NOT NULL,
            filename       TEXT NOT NULL,
            cloud_url      TEXT NOT NULL DEFAULT '',
            public_id      TEXT NOT NULL DEFAULT '',
            size_bytes     INTEGER DEFAULT 0,
            chunks_indexed INTEGER DEFAULT 0,
            uploaded_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_public      INTEGER DEFAULT 0,
            stream         TEXT DEFAULT '',
            course         TEXT DEFAULT '',
            semester       TEXT DEFAULT '',
            subject        TEXT DEFAULT '',
            uploader_name  TEXT DEFAULT '',
            UNIQUE(user_email, filename)
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_activity_user_email ON activity_log(user_email)",
        "CREATE INDEX IF NOT EXISTS idx_quiz_user_email     ON quiz_attempts(user_email)",
        "CREATE INDEX IF NOT EXISTS idx_pdf_user_email      ON pdf_files(user_email)",
        "CREATE INDEX IF NOT EXISTS idx_pdf_is_public       ON pdf_files(is_public)",
    ]
    for stmt in statements:
        cur.execute(stmt)

    # Safe migrations — add new columns to existing tables if not present
    _add_column_if_missing(cur, "pdf_files", "is_public",     "INTEGER DEFAULT 0")
    _add_column_if_missing(cur, "pdf_files", "stream",        "TEXT DEFAULT ''")
    _add_column_if_missing(cur, "pdf_files", "course",        "TEXT DEFAULT ''")
    _add_column_if_missing(cur, "pdf_files", "semester",      "TEXT DEFAULT ''")
    _add_column_if_missing(cur, "pdf_files", "subject",       "TEXT DEFAULT ''")
    _add_column_if_missing(cur, "pdf_files", "uploader_name", "TEXT DEFAULT ''")

    conn.commit()
    cur.close()
    conn.close()
    logger.info("SQLite database initialized at %s", DB_PATH)


def _add_column_if_missing(cur, table: str, column: str, definition: str) -> None:
    """Add a column to a table only if it doesn't already exist (safe migration)."""
    try:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
    except sqlite3.OperationalError:
        pass  # column already exists


# ── Password hashing (bcrypt) ──────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def check_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ── User CRUD ──────────────────────────────────────────────────────────────────

def create_user(
    name: str,
    email: str,
    password: str,
    mobile: str = "",
    google_id: str = "",
) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (name, email, password_hash, mobile, google_id) VALUES (?, ?, ?, ?, ?)",
            (name, email, hash_password(password) if password else "", mobile, google_id),
        )
        conn.commit()
        logger.info("Created user: %s", email)
        return True
    except sqlite3.IntegrityError:
        conn.rollback()
        logger.warning("Registration attempt for existing email: %s", email)
        return False
    finally:
        cur.close()
        conn.close()


def get_user_by_email(email: str) -> dict | None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def get_user_by_google_id(google_id: str) -> dict | None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE google_id = ?", (google_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def verify_password(email: str, password: str) -> bool:
    user = get_user_by_email(email)
    if not user or not user.get("password_hash"):
        return False
    stored = user["password_hash"]
    if stored.startswith("$2b$") or stored.startswith("$2a$"):
        return check_password(password, stored)
    import hashlib
    is_valid = stored == hashlib.sha256(password.encode()).hexdigest()
    if is_valid:
        logger.warning("User %s has a legacy SHA-256 password hash.", email)
    return is_valid


def update_profile(email: str, name: str, mobile: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("UPDATE users SET name = ?, mobile = ? WHERE email = ?", (name, mobile, email))
    conn.commit()
    cur.close()
    conn.close()


# ── Activity logging ───────────────────────────────────────────────────────────

def log_activity(user_email: str, action: str, detail: str = "") -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO activity_log (user_email, action, detail) VALUES (?, ?, ?)",
        (user_email, action, detail),
    )
    conn.commit()
    cur.close()
    conn.close()


# ── Quiz attempts ──────────────────────────────────────────────────────────────

def save_quiz_attempt(user_email: str, score: int, total: int, topic: str = "General") -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO quiz_attempts (user_email, score, total, topic) VALUES (?, ?, ?, ?)",
        (user_email, score, total, topic),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_dashboard_data(user_email: str) -> dict:
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        "SELECT score, total, topic, created_at FROM quiz_attempts WHERE user_email = ? ORDER BY created_at ASC",
        (user_email,),
    )
    attempts = [dict(r) for r in cur.fetchall()]

    cur.execute(
        "SELECT action, detail, created_at FROM activity_log WHERE user_email = ? ORDER BY created_at DESC LIMIT 20",
        (user_email,),
    )
    activity = [dict(r) for r in cur.fetchall()]

    cur.execute(
        "SELECT COUNT(*) AS cnt FROM activity_log WHERE user_email = ? AND action = 'asked'",
        (user_email,),
    )
    questions_asked = cur.fetchone()["cnt"]

    cur.execute(
        "SELECT COUNT(*) AS cnt FROM activity_log WHERE user_email = ? AND action = 'uploaded'",
        (user_email,),
    )
    pdfs_uploaded = cur.fetchone()["cnt"]

    cur.close()
    conn.close()

    avg_score = 0.0
    if attempts:
        avg_score = round(
            sum(q["score"] / q["total"] * 100 for q in attempts) / len(attempts), 1
        )

    return {
        "quiz_attempts": attempts,
        "total_quizzes": len(attempts),
        "average_score": avg_score,
        "questions_asked": questions_asked,
        "pdfs_uploaded": pdfs_uploaded,
        "recent_activity": activity,
    }


# ── PDF file records ───────────────────────────────────────────────────────────

def save_pdf_record(
    user_email: str,
    filename: str,
    cloud_url: str,
    public_id: str,
    size_bytes: int,
    chunks_indexed: int,
    is_public: bool = False,
    stream: str = "",
    course: str = "",
    semester: str = "",
    subject: str = "",
    uploader_name: str = "",
) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO pdf_files
            (user_email, filename, cloud_url, public_id, size_bytes, chunks_indexed,
             is_public, stream, course, semester, subject, uploader_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_email, filename) DO UPDATE SET
            cloud_url      = excluded.cloud_url,
            public_id      = excluded.public_id,
            size_bytes     = excluded.size_bytes,
            chunks_indexed = excluded.chunks_indexed,
            is_public      = excluded.is_public,
            stream         = excluded.stream,
            course         = excluded.course,
            semester       = excluded.semester,
            subject        = excluded.subject,
            uploader_name  = excluded.uploader_name,
            uploaded_at    = CURRENT_TIMESTAMP
        """,
        (user_email, filename, cloud_url, public_id, size_bytes, chunks_indexed,
         1 if is_public else 0, stream, course, semester, subject, uploader_name),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_user_pdfs(user_email: str) -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT filename, cloud_url, public_id, size_bytes, chunks_indexed, uploaded_at "
        "FROM pdf_files WHERE user_email = ? ORDER BY uploaded_at DESC",
        (user_email,),
    )
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def get_pdf_record(user_email: str, filename: str) -> dict | None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM pdf_files WHERE user_email = ? AND filename = ?", (user_email, filename))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def delete_pdf_record(user_email: str, filename: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM pdf_files WHERE user_email = ? AND filename = ?", (user_email, filename))
    conn.commit()
    cur.close()
    conn.close()


def delete_all_pdf_records(user_email: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM pdf_files WHERE user_email = ?", (user_email,))
    conn.commit()
    cur.close()
    conn.close()


def get_public_pdfs(
    stream: str = "",
    course: str = "",
    semester: str = "",
    search: str = "",
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Return publicly shared notes with optional filters."""
    conn = get_conn()
    cur = conn.cursor()

    conditions = ["is_public = 1", "cloud_url != ''"]
    params: list = []

    if stream:
        conditions.append("stream = ?")
        params.append(stream)
    if course:
        conditions.append("course = ?")
        params.append(course)
    if semester:
        conditions.append("semester = ?")
        params.append(semester)
    if search:
        conditions.append("(LOWER(filename) LIKE ? OR LOWER(subject) LIKE ?)")
        like = f"%{search.lower()}%"
        params.extend([like, like])

    where = " AND ".join(conditions)
    params.extend([limit, offset])

    cur.execute(
        f"SELECT id, filename, cloud_url, size_bytes, chunks_indexed, uploaded_at, "
        f"stream, course, semester, subject, uploader_name "
        f"FROM pdf_files WHERE {where} ORDER BY uploaded_at DESC LIMIT ? OFFSET ?",
        params,
    )
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return rows

"""
Database layer — PostgreSQL via psycopg2.

Replaces the previous SQLite implementation. The public API is identical so
no callers outside this module need to change.
"""
import os
import bcrypt
import logging
import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)

# Reads from environment — docker-compose injects this automatically;
# for local dev without Docker set DATABASE_URL in your .env file.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://askmynotes:askmynotes@localhost:5432/askmynotes",
)


# ── Connection helper ──────────────────────────────────────────────────────────

def get_conn() -> psycopg2.extensions.connection:
    """Open and return a new PostgreSQL connection."""
    conn = psycopg2.connect(DATABASE_URL)
    return conn


def _cursor(conn) -> psycopg2.extras.RealDictCursor:
    """Return a RealDictCursor (rows behave like dicts)."""
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


# ── Schema init ────────────────────────────────────────────────────────────────

def init_db() -> None:
    """Create all tables and indexes if they do not already exist."""
    conn = get_conn()
    cur = conn.cursor()
    statements = [
        """
        CREATE TABLE IF NOT EXISTS users (
            id          SERIAL PRIMARY KEY,
            name        TEXT NOT NULL,
            email       TEXT UNIQUE NOT NULL,
            mobile      TEXT DEFAULT '',
            password_hash TEXT DEFAULT '',
            google_id   TEXT DEFAULT '',
            avatar_color TEXT DEFAULT '#4F46E5',
            created_at  TIMESTAMP DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id          SERIAL PRIMARY KEY,
            user_email  TEXT NOT NULL,
            score       INTEGER NOT NULL,
            total       INTEGER NOT NULL,
            topic       TEXT DEFAULT 'General',
            created_at  TIMESTAMP DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS activity_log (
            id          SERIAL PRIMARY KEY,
            user_email  TEXT NOT NULL,
            action      TEXT NOT NULL,
            detail      TEXT DEFAULT '',
            created_at  TIMESTAMP DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS pdf_files (
            id              SERIAL PRIMARY KEY,
            user_email      TEXT NOT NULL,
            filename        TEXT NOT NULL,
            cloud_url       TEXT NOT NULL,
            public_id       TEXT NOT NULL,
            size_bytes      INTEGER DEFAULT 0,
            chunks_indexed  INTEGER DEFAULT 0,
            uploaded_at     TIMESTAMP DEFAULT NOW(),
            is_public       BOOLEAN DEFAULT FALSE,
            stream          TEXT DEFAULT '',
            course          TEXT DEFAULT '',
            semester        TEXT DEFAULT '',
            subject         TEXT DEFAULT '',
            uploader_name   TEXT DEFAULT '',
            UNIQUE(user_email, filename)
        )
        """,
        # Add new columns to existing tables (safe — IF NOT EXISTS equivalent via DO block)
        """
        DO $$ BEGIN
            ALTER TABLE pdf_files ADD COLUMN IF NOT EXISTS is_public     BOOLEAN DEFAULT FALSE;
            ALTER TABLE pdf_files ADD COLUMN IF NOT EXISTS stream        TEXT DEFAULT '';
            ALTER TABLE pdf_files ADD COLUMN IF NOT EXISTS course        TEXT DEFAULT '';
            ALTER TABLE pdf_files ADD COLUMN IF NOT EXISTS semester      TEXT DEFAULT '';
            ALTER TABLE pdf_files ADD COLUMN IF NOT EXISTS subject       TEXT DEFAULT '';
            ALTER TABLE pdf_files ADD COLUMN IF NOT EXISTS uploader_name TEXT DEFAULT '';
        EXCEPTION WHEN others THEN NULL;
        END $$;
        """,
        # Indexes for common query patterns
        "CREATE INDEX IF NOT EXISTS idx_activity_user_email ON activity_log(user_email)",
        "CREATE INDEX IF NOT EXISTS idx_quiz_user_email    ON quiz_attempts(user_email)",
        "CREATE INDEX IF NOT EXISTS idx_pdf_user_email     ON pdf_files(user_email)",
        "CREATE INDEX IF NOT EXISTS idx_pdf_is_public      ON pdf_files(is_public)",
    ]
    for stmt in statements:
        cur.execute(stmt)
    conn.commit()
    cur.close()
    conn.close()
    logger.info("PostgreSQL database initialized (%s)", DATABASE_URL.split("@")[-1])


# ── Password hashing (bcrypt) ──────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a password using bcrypt. Safe for production."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def check_password(password: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
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
            "INSERT INTO users (name, email, password_hash, mobile, google_id) "
            "VALUES (%s, %s, %s, %s, %s)",
            (name, email, hash_password(password) if password else "", mobile, google_id),
        )
        conn.commit()
        logger.info("Created user: %s", email)
        return True
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        logger.warning("Registration attempt for existing email: %s", email)
        return False
    finally:
        cur.close()
        conn.close()


def get_user_by_email(email: str) -> dict | None:
    conn = get_conn()
    cur = _cursor(conn)
    cur.execute("SELECT * FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def get_user_by_google_id(google_id: str) -> dict | None:
    conn = get_conn()
    cur = _cursor(conn)
    cur.execute("SELECT * FROM users WHERE google_id = %s", (google_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def verify_password(email: str, password: str) -> bool:
    user = get_user_by_email(email)
    if not user or not user.get("password_hash"):
        return False
    stored = user["password_hash"]
    # Support legacy SHA-256 hashes by detecting bcrypt prefix
    if stored.startswith("$2b$") or stored.startswith("$2a$"):
        return check_password(password, stored)
    # Legacy SHA-256 path — log a warning and suggest migration
    import hashlib
    is_valid = stored == hashlib.sha256(password.encode()).hexdigest()
    if is_valid:
        logger.warning(
            "User %s has a legacy SHA-256 password hash. "
            "Consider prompting them to reset their password.",
            email,
        )
    return is_valid


def update_profile(email: str, name: str, mobile: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET name = %s, mobile = %s WHERE email = %s",
        (name, mobile, email),
    )
    conn.commit()
    cur.close()
    conn.close()


# ── Activity logging ───────────────────────────────────────────────────────────

def log_activity(user_email: str, action: str, detail: str = "") -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO activity_log (user_email, action, detail) VALUES (%s, %s, %s)",
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
        "INSERT INTO quiz_attempts (user_email, score, total, topic) VALUES (%s, %s, %s, %s)",
        (user_email, score, total, topic),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_dashboard_data(user_email: str) -> dict:
    conn = get_conn()
    cur = _cursor(conn)

    cur.execute(
        "SELECT score, total, topic, created_at FROM quiz_attempts "
        "WHERE user_email = %s ORDER BY created_at ASC",
        (user_email,),
    )
    attempts = cur.fetchall()

    cur.execute(
        "SELECT action, detail, created_at FROM activity_log "
        "WHERE user_email = %s ORDER BY created_at DESC LIMIT 20",
        (user_email,),
    )
    activity = cur.fetchall()

    cur.execute(
        "SELECT COUNT(*) AS cnt FROM activity_log WHERE user_email = %s AND action = 'asked'",
        (user_email,),
    )
    questions_asked = cur.fetchone()["cnt"]

    cur.execute(
        "SELECT COUNT(*) AS cnt FROM activity_log WHERE user_email = %s AND action = 'uploaded'",
        (user_email,),
    )
    pdfs_uploaded = cur.fetchone()["cnt"]

    cur.close()
    conn.close()

    quiz_list = [dict(a) for a in attempts]
    # Convert datetime objects to ISO strings for JSON serialization
    for q in quiz_list:
        if hasattr(q.get("created_at"), "isoformat"):
            q["created_at"] = q["created_at"].isoformat()

    avg_score = 0.0
    if quiz_list:
        avg_score = round(
            sum(q["score"] / q["total"] * 100 for q in quiz_list) / len(quiz_list), 1
        )

    recent_activity = []
    for a in activity:
        a_dict = dict(a)
        if hasattr(a_dict.get("created_at"), "isoformat"):
            a_dict["created_at"] = a_dict["created_at"].isoformat()
        recent_activity.append(a_dict)

    return {
        "quiz_attempts": quiz_list,
        "total_quizzes": len(quiz_list),
        "average_score": avg_score,
        "questions_asked": questions_asked,
        "pdfs_uploaded": pdfs_uploaded,
        "recent_activity": recent_activity,
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
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (user_email, filename) DO UPDATE SET
            cloud_url      = EXCLUDED.cloud_url,
            public_id      = EXCLUDED.public_id,
            size_bytes     = EXCLUDED.size_bytes,
            chunks_indexed = EXCLUDED.chunks_indexed,
            is_public      = EXCLUDED.is_public,
            stream         = EXCLUDED.stream,
            course         = EXCLUDED.course,
            semester       = EXCLUDED.semester,
            subject        = EXCLUDED.subject,
            uploader_name  = EXCLUDED.uploader_name,
            uploaded_at    = NOW()
        """,
        (user_email, filename, cloud_url, public_id, size_bytes, chunks_indexed,
         is_public, stream, course, semester, subject, uploader_name),
    )
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
    cur = _cursor(conn)
    conditions = ["is_public = TRUE", "cloud_url != ''"]
    params: list = []
    if stream:
        conditions.append("stream = %s")
        params.append(stream)
    if course:
        conditions.append("course = %s")
        params.append(course)
    if semester:
        conditions.append("semester = %s")
        params.append(semester)
    if search:
        conditions.append("(LOWER(filename) LIKE %s OR LOWER(subject) LIKE %s)")
        like = f"%{search.lower()}%"
        params.extend([like, like])
    where = " AND ".join(conditions)
    params.extend([limit, offset])
    cur.execute(
        f"SELECT id, filename, cloud_url, size_bytes, chunks_indexed, uploaded_at, "
        f"stream, course, semester, subject, uploader_name "
        f"FROM pdf_files WHERE {where} ORDER BY uploaded_at DESC LIMIT %s OFFSET %s",
        params,
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        if hasattr(d.get("uploaded_at"), "isoformat"):
            d["uploaded_at"] = d["uploaded_at"].isoformat()
        result.append(d)
    return result


def get_user_pdfs(user_email: str) -> list[dict]:
    conn = get_conn()
    cur = _cursor(conn)
    cur.execute(
        "SELECT filename, cloud_url, public_id, size_bytes, chunks_indexed, uploaded_at "
        "FROM pdf_files WHERE user_email = %s ORDER BY uploaded_at DESC",
        (user_email,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        if hasattr(d.get("uploaded_at"), "isoformat"):
            d["uploaded_at"] = d["uploaded_at"].isoformat()
        result.append(d)
    return result


def get_pdf_record(user_email: str, filename: str) -> dict | None:
    conn = get_conn()
    cur = _cursor(conn)
    cur.execute(
        "SELECT * FROM pdf_files WHERE user_email = %s AND filename = %s",
        (user_email, filename),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def delete_pdf_record(user_email: str, filename: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM pdf_files WHERE user_email = %s AND filename = %s",
        (user_email, filename),
    )
    conn.commit()
    cur.close()
    conn.close()


def delete_all_pdf_records(user_email: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM pdf_files WHERE user_email = %s", (user_email,))
    conn.commit()
    cur.close()
    conn.close()

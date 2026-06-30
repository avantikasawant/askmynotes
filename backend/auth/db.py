import sqlite3
import os
import hashlib

DB_PATH = os.getenv("DB_PATH", "askmynotes.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            mobile TEXT DEFAULT '',
            password_hash TEXT DEFAULT '',
            google_id TEXT DEFAULT '',
            avatar_color TEXT DEFAULT '#4F46E5',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT NOT NULL,
            score INTEGER NOT NULL,
            total INTEGER NOT NULL,
            topic TEXT DEFAULT 'General',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT NOT NULL,
            action TEXT NOT NULL,
            detail TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS pdf_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_email TEXT NOT NULL,
            filename TEXT NOT NULL,
            cloud_url TEXT NOT NULL,
            public_id TEXT NOT NULL,
            size_bytes INTEGER DEFAULT 0,
            chunks_indexed INTEGER DEFAULT 0,
            uploaded_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_email, filename)
        );
    """)
    conn.commit()
    conn.close()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_user(name, email, password, mobile="", google_id=""):
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO users (name, email, password_hash, mobile, google_id) VALUES (?,?,?,?,?)",
            (name, email, hash_password(password) if password else "", mobile, google_id)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def get_user_by_email(email: str):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_google_id(google_id: str):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE google_id=?", (google_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def verify_password(email: str, password: str) -> bool:
    user = get_user_by_email(email)
    if not user:
        return False
    return user["password_hash"] == hash_password(password)

def update_profile(email: str, name: str, mobile: str):
    conn = get_conn()
    conn.execute("UPDATE users SET name=?, mobile=? WHERE email=?", (name, mobile, email))
    conn.commit()
    conn.close()

def log_activity(user_email: str, action: str, detail: str = ""):
    conn = get_conn()
    conn.execute(
        "INSERT INTO activity_log (user_email, action, detail) VALUES (?,?,?)",
        (user_email, action, detail)
    )
    conn.commit()
    conn.close()

def save_quiz_attempt(user_email: str, score: int, total: int, topic: str = "General"):
    conn = get_conn()
    conn.execute(
        "INSERT INTO quiz_attempts (user_email, score, total, topic) VALUES (?,?,?,?)",
        (user_email, score, total, topic)
    )
    conn.commit()
    conn.close()

def get_dashboard_data(user_email: str) -> dict:
    conn = get_conn()
    attempts = conn.execute(
        "SELECT score, total, topic, created_at FROM quiz_attempts WHERE user_email=? ORDER BY created_at ASC",
        (user_email,)
    ).fetchall()
    activity = conn.execute(
        "SELECT action, detail, created_at FROM activity_log WHERE user_email=? ORDER BY created_at DESC LIMIT 20",
        (user_email,)
    ).fetchall()
    questions_asked = conn.execute(
        "SELECT COUNT(*) as cnt FROM activity_log WHERE user_email=? AND action='asked'",
        (user_email,)
    ).fetchone()["cnt"]
    pdfs_uploaded = conn.execute(
        "SELECT COUNT(*) as cnt FROM activity_log WHERE user_email=? AND action='uploaded'",
        (user_email,)
    ).fetchone()["cnt"]
    conn.close()

    quiz_list = [dict(a) for a in attempts]
    avg_score = 0
    if quiz_list:
        avg_score = round(sum(q["score"] / q["total"] * 100 for q in quiz_list) / len(quiz_list), 1)

    return {
        "quiz_attempts": quiz_list,
        "total_quizzes": len(quiz_list),
        "average_score": avg_score,
        "questions_asked": questions_asked,
        "pdfs_uploaded": pdfs_uploaded,
        "recent_activity": [dict(a) for a in activity],
    }


def save_pdf_record(user_email, filename, cloud_url, public_id, size_bytes, chunks_indexed):
    conn = get_conn()
    conn.execute(
        """INSERT INTO pdf_files (user_email, filename, cloud_url, public_id, size_bytes, chunks_indexed)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(user_email, filename) DO UPDATE SET
             cloud_url=excluded.cloud_url, public_id=excluded.public_id,
             size_bytes=excluded.size_bytes, chunks_indexed=excluded.chunks_indexed,
             uploaded_at=datetime('now')""",
        (user_email, filename, cloud_url, public_id, size_bytes, chunks_indexed)
    )
    conn.commit()
    conn.close()

def get_user_pdfs(user_email: str) -> list:
    conn = get_conn()
    rows = conn.execute(
        "SELECT filename, cloud_url, public_id, size_bytes, chunks_indexed, uploaded_at FROM pdf_files WHERE user_email=? ORDER BY uploaded_at DESC",
        (user_email,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_pdf_record(user_email: str, filename: str):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM pdf_files WHERE user_email=? AND filename=?",
        (user_email, filename)
    ).fetchone()
    conn.close()
    return dict(row) if row else None

def delete_pdf_record(user_email: str, filename: str):
    conn = get_conn()
    conn.execute("DELETE FROM pdf_files WHERE user_email=? AND filename=?", (user_email, filename))
    conn.commit()
    conn.close()

def delete_all_pdf_records(user_email: str):
    conn = get_conn()
    conn.execute("DELETE FROM pdf_files WHERE user_email=?", (user_email,))
    conn.commit()
    conn.close()

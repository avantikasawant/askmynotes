"""
Upload routes: single file, multiple files.

Files are saved to disk, embedded in the background, and optionally uploaded
to Cloudinary if the user marks them as public (is_public=True).
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from rag_pipeline import ingest_document, _get_redis
from auth.db import log_activity, save_pdf_record, get_user_by_email
from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["upload"])

UPLOAD_DIR = "uploaded_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".txt"}
SUPPORTED_LABEL = ".pdf, .docx, .pptx, .txt"
MAX_FILE_MB = 10
MAX_TOTAL_MB = 20

_JOB_TTL = 7200
_JOB_PREFIX = "askmynotes:job"


# ── Job status helpers ─────────────────────────────────────────────────────────

def _job_key(job_id: str) -> str:
    return f"{_JOB_PREFIX}:{job_id}"


def _set_job(job_id: str, data: dict) -> None:
    r = _get_redis()
    if r is None:
        return
    try:
        r.setex(_job_key(job_id), _JOB_TTL, json.dumps(data))
    except Exception:
        pass


def get_job(job_id: str) -> dict | None:
    r = _get_redis()
    if r is None:
        return None
    try:
        raw = r.get(_job_key(job_id))
        return json.loads(raw) if raw else None
    except Exception:
        return None


# ── Extension validation ───────────────────────────────────────────────────────

def _validate_extension(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Supported: {SUPPORTED_LABEL}",
        )
    return ext


# ── Background ingestion task ──────────────────────────────────────────────────

def _ingest_in_background(
    job_id: str,
    file_path: str,
    filename: str,
    size_bytes: int,
    user_email: str,
    is_public: bool = False,
    stream: str = "",
    course: str = "",
    semester: str = "",
    subject: str = "",
    uploader_name: str = "",
) -> None:
    _set_job(job_id, {
        "status": "processing",
        "filename": filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        chunk_count = ingest_document(file_path, user_email)
        log_activity(user_email, "uploaded", filename)
        logger.info("User %s ingested %s (%d chunks)", user_email, filename, chunk_count)

        # Upload to Cloudinary if the user chose to share publicly
        cloud_url = ""
        public_id = ""
        if is_public:
            try:
                from cloud_storage import upload_pdf_to_cloud
                safe_id = f"{user_email.split('@')[0]}_{uuid.uuid4().hex[:8]}_{filename}"
                result = upload_pdf_to_cloud(file_path, safe_id)
                cloud_url = result["url"]
                public_id = result["public_id"]
                logger.info("Uploaded public note to Cloudinary: %s", cloud_url)
            except Exception as e:
                logger.warning("Cloudinary upload failed for %s: %s — marking private", filename, e)
                is_public = False

        try:
            save_pdf_record(
                user_email, filename, cloud_url, public_id,
                size_bytes, chunk_count,
                is_public=is_public,
                stream=stream, course=course, semester=semester,
                subject=subject, uploader_name=uploader_name,
            )
        except Exception:
            pass  # Non-fatal

        _set_job(job_id, {
            "status": "done",
            "filename": filename,
            "chunks_indexed": chunk_count,
            "is_public": is_public,
            "cloud_url": cloud_url,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:
        logger.exception("Background ingestion failed for %s (user=%s)", filename, user_email)
        _set_job(job_id, {
            "status": "error",
            "filename": filename,
            "error": str(exc),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    is_public: bool = Form(False),
    stream:    str = Form(""),
    course:    str = Form(""),
    semester:  str = Form(""),
    subject:   str = Form(""),
    user: dict = Depends(get_current_user),
):
    """
    Accept a file and optional sharing metadata.
    If is_public=True, the file will be uploaded to Cloudinary after indexing
    and appear in the public Notes Library.
    """
    _validate_extension(file.filename)
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size_mb:.1f} MB). Max allowed: {MAX_FILE_MB} MB",
        )

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(contents)

    # Fetch uploader name for the public library listing
    uploader_name = ""
    try:
        db_user = get_user_by_email(user["sub"])
        uploader_name = db_user["name"] if db_user else ""
    except Exception:
        pass

    job_id = str(uuid.uuid4())
    _set_job(job_id, {
        "status": "pending",
        "filename": file.filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    background_tasks.add_task(
        _ingest_in_background,
        job_id, file_path, file.filename, len(contents), user["sub"],
        is_public, stream, course, semester, subject, uploader_name,
    )

    logger.info("User %s queued upload: %s (job=%s, public=%s)", user["sub"], file.filename, job_id, is_public)
    return {
        "status": "processing",
        "job_id": job_id,
        "filename": file.filename,
        "message": f"Indexing started. Poll GET /jobs/{job_id} for progress.",
    }


@router.post("/upload/multiple")
async def upload_multiple_files(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    is_public: bool = Form(False),
    stream:    str = Form(""),
    course:    str = Form(""),
    semester:  str = Form(""),
    subject:   str = Form(""),
    user: dict = Depends(get_current_user),
):
    """Accept multiple files with shared metadata (same stream/course/semester for all)."""
    total_size = 0.0
    results = []

    uploader_name = ""
    try:
        db_user = get_user_by_email(user["sub"])
        uploader_name = db_user["name"] if db_user else ""
    except Exception:
        pass

    for file in files:
        try:
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in SUPPORTED_EXTENSIONS:
                results.append({
                    "filename": file.filename,
                    "status": "error",
                    "message": f"Unsupported type. Use: {SUPPORTED_LABEL}",
                })
                continue

            contents = await file.read()
            size_mb = len(contents) / (1024 * 1024)

            if size_mb > MAX_FILE_MB:
                results.append({
                    "filename": file.filename,
                    "status": "error",
                    "message": f"File too large ({size_mb:.1f} MB). Max per file: {MAX_FILE_MB} MB",
                })
                continue

            total_size += size_mb
            if total_size > MAX_TOTAL_MB:
                results.append({
                    "filename": file.filename,
                    "status": "error",
                    "message": f"Batch limit exceeded ({MAX_TOTAL_MB} MB total)",
                })
                continue

            file_path = os.path.join(UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as f:
                f.write(contents)

            job_id = str(uuid.uuid4())
            _set_job(job_id, {
                "status": "pending",
                "filename": file.filename,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

            background_tasks.add_task(
                _ingest_in_background,
                job_id, file_path, file.filename, len(contents), user["sub"],
                is_public, stream, course, semester, subject, uploader_name,
            )

            results.append({
                "filename": file.filename,
                "status": "processing",
                "job_id": job_id,
            })

        except Exception as e:
            logger.exception("Error processing file %s for user %s", file.filename, user["sub"])
            results.append({"filename": file.filename, "status": "error", "message": str(e)})

    return {
        "results": results,
        "total_files": len(files),
        "queued": sum(1 for r in results if r["status"] == "processing"),
    }

"""Library routes: list, delete user files; public notes library."""
import logging
from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse

from rag_pipeline import list_indexed_files, clear_vectorstore, delete_file_from_vectorstore
from auth.db import get_public_pdfs, get_user_pdfs
from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["library"])


# ── Public endpoints (no auth required) ───────────────────────────────────────

@router.get("/public/notes")
async def get_public_notes(
    stream:   str = Query("", description="Filter by academic stream"),
    course:   str = Query("", description="Filter by course"),
    semester: str = Query("", description="Filter by semester"),
    search:   str = Query("", description="Search filename or subject"),
    limit:    int = Query(20, ge=1, le=100),
    offset:   int = Query(0, ge=0),
):
    """Return publicly shared notes — accessible without login."""
    notes = get_public_pdfs(
        stream=stream, course=course, semester=semester,
        search=search, limit=limit, offset=offset,
    )
    return {"notes": notes, "total": len(notes)}


@router.get("/public/notes/download/{note_id}")
async def download_public_note(note_id: int):
    """Redirect to the Cloudinary URL for a public note download."""
    from auth.db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT cloud_url FROM pdf_files WHERE id = ? AND is_public = 1 AND cloud_url != ''",
        (note_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Note not found or not public")
    return RedirectResponse(url=row["cloud_url"])


# ── Authenticated user library ─────────────────────────────────────────────────

@router.get("/library")
async def get_library(user: dict = Depends(get_current_user)):
    """Return list of indexed files for the logged-in user (from ChromaDB)."""
    files = list_indexed_files(user["sub"])
    return {"pdfs": [{"filename": f} for f in files]}


@router.delete("/library/{filename}")
async def delete_from_library(filename: str, user: dict = Depends(get_current_user)):
    """Remove a specific file's chunks from the user's vector store."""
    deleted = delete_file_from_vectorstore(user["sub"], filename)
    logger.info("User %s deleted %s (%d chunks removed)", user["sub"], filename, deleted)
    return {"status": "deleted", "chunks_removed": deleted}


# ── Legacy /files endpoint (kept for backward compat) ─────────────────────────

@router.get("/files")
async def get_files(user: dict = Depends(get_current_user)):
    return {"files": list_indexed_files(user["sub"])}


@router.delete("/files")
async def clear_files(user: dict = Depends(get_current_user)):
    import os
    clear_vectorstore(user["sub"])
    upload_dir = "uploaded_pdfs"
    if os.path.isdir(upload_dir):
        for f in os.listdir(upload_dir):
            try:
                os.remove(os.path.join(upload_dir, f))
            except OSError as e:
                logger.warning("Could not delete file %s: %s", f, e)
    return {"status": "cleared"}

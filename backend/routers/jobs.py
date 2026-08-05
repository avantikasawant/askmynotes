"""
Jobs router — poll the status of background ingestion tasks.

Endpoint:
  GET /api/v1/jobs/{job_id}

Possible statuses:
  pending    — job queued, not yet started
  processing — embedding / indexing in progress
  done       — successfully indexed; chunks_indexed is set
  error      — ingestion failed; error message is set
  not_found  — job_id unknown or expired (TTL of 2 hours)
"""
import logging
from fastapi import APIRouter, Depends, HTTPException

from routers.upload import get_job
from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["jobs"])


@router.get("/jobs/{job_id}")
async def get_job_status(
    job_id: str,
    user: dict = Depends(get_current_user),
):
    """
    Poll the status of a background ingestion job.
    Auth required — anyone with a valid token can query any job_id they hold.
    Job records expire automatically after 2 hours.
    """
    job = get_job(job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail={
                "status": "not_found",
                "message": "Job not found or expired (TTL is 2 hours).",
            },
        )
    return job

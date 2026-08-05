"""YouTube video search routes."""
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from youtube_search import search_youtube_video, search_youtube_videos
from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["youtube"])


class VideoRequest(BaseModel):
    topic: str


class VideosRequest(BaseModel):
    topic: str
    max_results: int = 5


@router.post("/video")
async def get_video(payload: VideoRequest, user: dict = Depends(get_current_user)):
    return await search_youtube_video(payload.topic)


@router.post("/videos")
async def get_videos(payload: VideosRequest, user: dict = Depends(get_current_user)):
    return await search_youtube_videos(payload.topic, max_results=payload.max_results)

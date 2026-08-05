"""Quiz routes: generate, save score, get topics."""
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from quiz import generate_quiz, get_quiz_topics
from auth.db import save_quiz_attempt
from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/quiz", tags=["quiz"])


class QuizRequest(BaseModel):
    difficulty: str = "medium"


@router.post("")
async def quiz_endpoint(
    payload: QuizRequest = QuizRequest(),
    user: dict = Depends(get_current_user),
):
    logger.info("Quiz requested by %s (difficulty=%s)", user["sub"], payload.difficulty)
    return generate_quiz(user["sub"], payload.difficulty)


@router.post("/save")
async def save_quiz(score: int, total: int, user: dict = Depends(get_current_user)):
    save_quiz_attempt(user["sub"], score, total)
    return {"status": "saved"}


@router.get("/topics")
async def quiz_topics(difficulty: str = "medium", user: dict = Depends(get_current_user)):
    return get_quiz_topics(user["sub"], difficulty)

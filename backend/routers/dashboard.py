"""Dashboard and study-guide routes."""
import json
import logging
import os
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth.db import get_dashboard_data
from rag_pipeline import get_top_chunks
from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    return get_dashboard_data(user["sub"])


@router.post("/study-guide")
async def study_guide(user: dict = Depends(get_current_user)):
    content = get_top_chunks(user["sub"], k=10)
    if not content.strip():
        return {"error": "No notes uploaded yet."}

    from groq import Groq

    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    prompt = f"""Analyse these lecture notes and return ONLY valid JSON:
{{
  "summary": "2-3 sentence overview",
  "topics": [{{"topic": "name", "priority": "high|medium|low", "reason": "why important"}}],
  "study_tips": ["tip 1", "tip 2", "tip 3"]
}}
Notes: {content}"""

    response = client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    try:
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        logger.exception("Failed to parse study guide JSON for user %s", user["sub"])
        return {"error": "Failed to generate study guide."}

"""Ask/QnA routes: standard and streaming."""
import json
import logging
import os
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from rag_pipeline import get_answer, get_relevant_docs
from auth.db import log_activity
from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(tags=["ask"])
limiter = Limiter(key_func=get_remote_address)


class AskRequest(BaseModel):
    question: str


@router.post("/ask")
@limiter.limit("30/minute")
async def ask_question(
    request: Request,
    payload: AskRequest,
    user: dict = Depends(get_current_user),
):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    result = get_answer(payload.question, user["sub"])
    log_activity(user["sub"], "asked", payload.question[:100])
    return result


@router.post("/ask/stream")
@limiter.limit("30/minute")
async def ask_stream(
    request: Request,
    payload: AskRequest,
    user: dict = Depends(get_current_user),
):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    from langchain_groq import ChatGroq

    docs = get_relevant_docs(user["sub"], payload.question, k=5)
    context = "\n\n".join(d.page_content for d in docs)

    sources = []
    seen: set = set()
    for doc in docs:
        page = doc.metadata.get("page", 0) + 1
        filename = os.path.basename(doc.metadata.get("source", "unknown"))
        if page not in seen:
            seen.add(page)
            sources.append({
                "page": page,
                "file": filename,
                "snippet": doc.page_content[:200].strip(),
            })

    prompt = (
        "Answer based ONLY on this context.\n"
        f"Context: {context}\n"
        f"Question: {payload.question}\n"
        "Answer:"
    )
    llm = ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        temperature=0,
        streaming=True,
    )

    async def generate():
        try:
            async for chunk in llm.astream(prompt):
                token = chunk.content
                if token:
                    yield f"data: {json.dumps({'token': token})}\n\n"
            yield f"data: {json.dumps({'sources': sources, 'done': True})}\n\n"
        except Exception as e:
            logger.exception("Streaming error for user %s", user["sub"])
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"

    log_activity(user["sub"], "asked", payload.question[:100])
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

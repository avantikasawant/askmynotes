from dotenv import load_dotenv
load_dotenv()  # MUST be first line — loads .env before any module reads os.getenv()

import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import httpx

from rag_pipeline import ingest_pdf, get_answer, list_indexed_files, clear_vectorstore
from quiz import generate_quiz
from auth.db import (
    init_db, create_user, get_user_by_email, get_user_by_google_id,
    verify_password, update_profile, log_activity, save_quiz_attempt, get_dashboard_data
)
from auth.jwt_handler import create_token, decode_token
from auth.models import UserRegister, UserLogin, GoogleLogin, UserProfile
from youtube_search import search_youtube_video

app = FastAPI(title="AskMyNotes API")

init_db()  # create SQLite tables on startup if they don't exist

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploaded_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/tokeninfo"


# ─── Auth helpers ────────────────────────────────────────────────────────────

def get_current_user(authorization: str = "") -> dict:
    """Extract and verify JWT from Authorization header."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        return decode_token(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


# ─── Auth endpoints ──────────────────────────────────────────────────────────

@app.post("/auth/register")
async def register(payload: UserRegister):
    ok = create_user(payload.name, payload.email, payload.password, payload.mobile)
    if not ok:
        raise HTTPException(status_code=400, detail="Email already registered")
    token = create_token(payload.email, payload.name)
    log_activity(payload.email, "registered")
    return {"token": token, "name": payload.name, "email": payload.email}


@app.post("/auth/login")
async def login(payload: UserLogin):
    if not verify_password(payload.email, payload.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = get_user_by_email(payload.email)
    token = create_token(payload.email, user["name"])
    return {"token": token, "name": user["name"], "email": payload.email}


@app.post("/auth/google")
async def google_login(payload: GoogleLogin):
    """Verify Google ID token and create/login user."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(GOOGLE_TOKEN_URL, params={"id_token": payload.token})
    info = resp.json()

    if "error" in info or resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = info.get("email")
    name = info.get("name", email)
    google_id = info.get("sub")

    user = get_user_by_email(email)
    if not user:
        create_user(name, email, "", "", google_id)
        log_activity(email, "registered", "google")

    token = create_token(email, name)
    return {"token": token, "name": name, "email": email}


@app.get("/auth/me")
async def get_me(authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    user = get_user_by_email(claims["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "name": user["name"],
        "email": user["email"],
        "mobile": user["mobile"],
        "created_at": user["created_at"],
    }


@app.put("/auth/profile")
async def update_user_profile(payload: UserProfile, authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    update_profile(claims["sub"], payload.name, payload.mobile)
    return {"status": "updated"}


# ─── PDF endpoints ───────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...), authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    chunk_count = ingest_pdf(file_path)
    log_activity(claims["sub"], "uploaded", file.filename)
    return {"status": "success", "filename": file.filename, "chunks_indexed": chunk_count}


@app.post("/ask")
async def ask_question(payload: AskRequest, authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    result = get_answer(payload.question)
    log_activity(claims["sub"], "asked", payload.question[:100])
    return result


class QuizRequest(BaseModel):
    difficulty: str = "medium"

@app.post("/quiz")
async def quiz_endpoint(payload: QuizRequest = QuizRequest(), authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    return generate_quiz(payload.difficulty)


@app.post("/quiz/save")
async def save_quiz(score: int, total: int, authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    save_quiz_attempt(claims["sub"], score, total)
    return {"status": "saved"}


@app.get("/files")
async def get_files(authorization: str = Header(default="")):
    get_current_user(authorization)
    return {"files": list_indexed_files()}


@app.delete("/files")
async def clear_files(authorization: str = Header(default="")):
    get_current_user(authorization)
    clear_vectorstore()
    for f in os.listdir(UPLOAD_DIR):
        os.remove(os.path.join(UPLOAD_DIR, f))
    return {"status": "cleared"}


# ─── Dashboard ───────────────────────────────────────────────────────────────

@app.get("/dashboard")
async def dashboard(authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    return get_dashboard_data(claims["sub"])


# ─── YouTube ─────────────────────────────────────────────────────────────────

class VideoRequest(BaseModel):
    topic: str


@app.post("/video")
async def get_video(payload: VideoRequest, authorization: str = Header(default="")):
    get_current_user(authorization)
    return await search_youtube_video(payload.topic)


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}


# ─── Streaming answer endpoint ────────────────────────────────────────────────

from fastapi.responses import StreamingResponse
from langchain_groq import ChatGroq
import json

@app.post("/ask/stream")
async def ask_stream(payload: AskRequest, authorization: str = Header(default="")):
    """Stream answer tokens as Server-Sent Events for real-time display."""
    claims = get_current_user(authorization)
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    from rag_pipeline import vectorstore, embeddings
    log_activity(claims["sub"], "asked", payload.question[:100])

    retriever = vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={"k": 6, "fetch_k": 12},
    )
    docs = retriever.invoke(payload.question)
    context = "\n\n".join(d.page_content for d in docs)

    sources = []
    seen = set()
    for doc in docs:
        page = doc.metadata.get("page", 0) + 1
        filename = os.path.basename(doc.metadata.get("source", "unknown"))
        if page not in seen:
            seen.add(page)
            sources.append({"page": page, "file": filename, "snippet": doc.page_content[:200].strip()})

    prompt = f"""Answer the question based ONLY on the context below.
Context: {context}
Question: {payload.question}
Answer:"""

    llm = ChatGroq(api_key=os.getenv("GROQ_API_KEY"), model="llama-3.1-8b-instant", temperature=0, streaming=True)

    async def generate():
        async for chunk in llm.astream(prompt):
            token = chunk.content
            if token:
                yield f"data: {json.dumps({'token': token})}\n\n"
        # Send sources after streaming completes
        yield f"data: {json.dumps({'sources': sources, 'done': True})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ─── Study Guide ─────────────────────────────────────────────────────────────

@app.post("/study-guide")
async def study_guide(authorization: str = Header(default="")):
    get_current_user(authorization)
    from rag_pipeline import get_top_chunks
    content = get_top_chunks(k=10)
    if not content.strip():
        return {"error": "No notes uploaded yet."}

    from groq import Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    prompt = f"""Analyse these lecture notes and return ONLY valid JSON with this structure:
{{
  "summary": "2-3 sentence overview of the document",
  "topics": [
    {{"topic": "topic name", "priority": "high|medium|low", "reason": "why this is important"}}
  ],
  "study_tips": ["tip 1", "tip 2", "tip 3"]
}}

Notes:
{content}"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    import json
    try:
        return json.loads(response.choices[0].message.content)
    except:
        return {"error": "Failed to generate study guide."}


# ─── PDF Serve ───────────────────────────────────────────────────────────────

from fastapi.responses import FileResponse

@app.get("/pdf/{filename}")
async def serve_pdf(filename: str, authorization: str = Header(default="")):
    get_current_user(authorization)
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF not found")
    return FileResponse(file_path, media_type="application/pdf")

from dotenv import load_dotenv
load_dotenv()

import os
import shutil
import json
from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, RedirectResponse
from pydantic import BaseModel
import httpx

from rag_pipeline import ingest_pdf, get_answer, list_indexed_files, clear_vectorstore, get_top_chunks, vectorstore
from quiz import generate_quiz, get_quiz_topics
from auth.db import (
    init_db, create_user, get_user_by_email, verify_password, update_profile,
    log_activity, save_quiz_attempt, get_dashboard_data,
    save_pdf_record, get_user_pdfs, get_pdf_record, delete_pdf_record, delete_all_pdf_records
)
from auth.jwt_handler import create_token, decode_token
from auth.models import UserRegister, UserLogin, GoogleLogin, UserProfile
from youtube_search import search_youtube_video, search_youtube_videos
from cloud_storage import upload_pdf_to_cloud, delete_pdf_from_cloud

app = FastAPI(title="AskMyNotes API")
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploaded_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/tokeninfo"


def get_current_user(authorization: str = "") -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        return decode_token(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


# ── Auth ──────────────────────────────────────────────────────────────────────

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
    return {"name": user["name"], "email": user["email"], "mobile": user["mobile"], "created_at": user["created_at"]}


@app.put("/auth/profile")
async def update_user_profile(payload: UserProfile, authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    update_profile(claims["sub"], payload.name, payload.mobile)
    return {"status": "updated"}


# ── PDF Upload (Cloudinary persistent storage) ────────────────────────────────

class AskRequest(BaseModel):
    question: str


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...), authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    chunk_count = ingest_pdf(file_path)

    # Upload to Cloudinary for permanent storage
    public_id = f"{claims['sub'].replace('@', '_').replace('.', '_')}/{file.filename}"
    try:
        cloud_result = upload_pdf_to_cloud(file_path, public_id)
        save_pdf_record(
            claims["sub"], file.filename, cloud_result["url"], cloud_result["public_id"],
            len(contents), chunk_count
        )
    except Exception as e:
        # Indexing succeeded even if cloud upload fails — don't block the response
        print(f"Cloudinary upload failed: {e}")

    log_activity(claims["sub"], "uploaded", file.filename)
    return {"status": "success", "filename": file.filename, "chunks_indexed": chunk_count}


@app.post("/upload/multiple")
async def upload_multiple_pdfs(files: list[UploadFile] = File(...), authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    MAX_TOTAL_MB = 20
    total_size = 0
    results = []

    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            results.append({"filename": file.filename, "status": "error", "message": "Not a PDF"})
            continue

        contents = await file.read()
        size_mb = len(contents) / (1024 * 1024)
        total_size += size_mb

        if total_size > MAX_TOTAL_MB:
            results.append({"filename": file.filename, "status": "error", "message": f"Exceeds {MAX_TOTAL_MB}MB limit"})
            continue

        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(contents)

        try:
            chunk_count = ingest_pdf(file_path)
            public_id = f"{claims['sub'].replace('@', '_').replace('.', '_')}/{file.filename}"
            try:
                cloud_result = upload_pdf_to_cloud(file_path, public_id)
                save_pdf_record(claims["sub"], file.filename, cloud_result["url"], cloud_result["public_id"], len(contents), chunk_count)
            except Exception as e:
                print(f"Cloudinary upload failed for {file.filename}: {e}")
            log_activity(claims["sub"], "uploaded", file.filename)
            results.append({"filename": file.filename, "status": "success", "chunks_indexed": chunk_count})
        except Exception as e:
            results.append({"filename": file.filename, "status": "error", "message": str(e)})

    return {"results": results, "total_files": len(files), "successful": sum(1 for r in results if r["status"] == "success")}


@app.get("/pdf/{filename}")
async def get_pdf_url(filename: str, authorization: str = Header(default="")):
    """Redirect to the permanent Cloudinary URL for this PDF."""
    claims = get_current_user(authorization)
    record = get_pdf_record(claims["sub"], filename)
    if not record:
        raise HTTPException(status_code=404, detail="PDF not found in your library")
    return RedirectResponse(url=record["cloud_url"])


@app.get("/library")
async def get_library(authorization: str = Header(default="")):
    """Return full PDF library with metadata for the logged-in user."""
    claims = get_current_user(authorization)
    return {"pdfs": get_user_pdfs(claims["sub"])}


@app.delete("/library/{filename}")
async def delete_from_library(filename: str, authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    record = get_pdf_record(claims["sub"], filename)
    if record:
        delete_pdf_from_cloud(record["public_id"])
        delete_pdf_record(claims["sub"], filename)
    return {"status": "deleted"}
@app.get("/library/{filename}/view")
async def view_pdf(filename: str, authorization: str = Header(default="")):
    """Proxy PDF from Cloudinary — bypasses CORS completely."""
    from fastapi.responses import Response
    claims = get_current_user(authorization)
    record = get_pdf_record(claims["sub"], filename)
    if not record:
        raise HTTPException(status_code=404, detail="PDF not found")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(record["cloud_url"], follow_redirects=True)
            resp.raise_for_status()
        return Response(content=resp.content, media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename={filename}", "Cache-Control": "private, max-age=3600"})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch PDF: {str(e)}")

@app.post("/ask")
async def ask_question(payload: AskRequest, authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    result = get_answer(payload.question)
    log_activity(claims["sub"], "asked", payload.question[:100])
    return result


@app.post("/ask/stream")
async def ask_stream(payload: AskRequest, authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    from langchain_groq import ChatGroq
    log_activity(claims["sub"], "asked", payload.question[:100])

    retriever = vectorstore.as_retriever(search_type="mmr", search_kwargs={"k": 6, "fetch_k": 12})
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

    prompt = f"Answer based ONLY on this context.\nContext: {context}\nQuestion: {payload.question}\nAnswer:"
    llm = ChatGroq(api_key=os.getenv("GROQ_API_KEY"), model="llama-3.1-8b-instant", temperature=0, streaming=True)

    async def generate():
        async for chunk in llm.astream(prompt):
            token = chunk.content
            if token:
                yield f"data: {json.dumps({'token': token})}\n\n"
        yield f"data: {json.dumps({'sources': sources, 'done': True})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── Quiz ──────────────────────────────────────────────────────────────────────

class QuizRequest(BaseModel):
    difficulty: str = "medium"


@app.post("/quiz")
async def quiz_endpoint(payload: QuizRequest = QuizRequest(), authorization: str = Header(default="")):
    get_current_user(authorization)
    return generate_quiz(payload.difficulty)


@app.post("/quiz/save")
async def save_quiz(score: int, total: int, authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    save_quiz_attempt(claims["sub"], score, total)
    return {"status": "saved"}


@app.get("/quiz/topics")
async def quiz_topics(difficulty: str = "medium", authorization: str = Header(default="")):
    get_current_user(authorization)
    return get_quiz_topics(difficulty)


# ── Files (legacy / vectorstore-level) ─────────────────────────────────────────

@app.get("/files")
async def get_files(authorization: str = Header(default="")):
    get_current_user(authorization)
    return {"files": list_indexed_files()}


@app.delete("/files")
async def clear_files(authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    clear_vectorstore()
    for f in os.listdir(UPLOAD_DIR):
        os.remove(os.path.join(UPLOAD_DIR, f))
    # Also clear cloud storage records for this user
    pdfs = get_user_pdfs(claims["sub"])
    for p in pdfs:
        delete_pdf_from_cloud(p["public_id"])
    delete_all_pdf_records(claims["sub"])
    return {"status": "cleared"}


# ── Dashboard ─────────────────────────────────────────────────────────────────

@app.get("/dashboard")
async def dashboard(authorization: str = Header(default="")):
    claims = get_current_user(authorization)
    return get_dashboard_data(claims["sub"])


# ── YouTube ───────────────────────────────────────────────────────────────────

class VideoRequest(BaseModel):
    topic: str

class VideosRequest(BaseModel):
    topic: str
    max_results: int = 5


@app.post("/video")
async def get_video(payload: VideoRequest, authorization: str = Header(default="")):
    get_current_user(authorization)
    return await search_youtube_video(payload.topic)


@app.post("/videos")
async def get_videos(payload: VideosRequest, authorization: str = Header(default="")):
    get_current_user(authorization)
    return await search_youtube_videos(payload.topic, max_results=payload.max_results)


# ── Study Guide ───────────────────────────────────────────────────────────────

@app.post("/study-guide")
async def study_guide(authorization: str = Header(default="")):
    get_current_user(authorization)
    content = get_top_chunks(k=10)
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
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    try:
        return json.loads(response.choices[0].message.content)
    except:
        return {"error": "Failed to generate study guide."}


@app.get("/health")
async def health():
    return {"status": "ok"}

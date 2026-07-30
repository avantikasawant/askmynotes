# AskMyNotes

An AI-powered study assistant. Upload your lecture notes and ask questions, generate quizzes, and get study guides — all grounded in your own material.

**Live demo:** https://askmynotes.vercel.app

---

## Features

- Ask questions about uploaded notes with page-level citations
- Generate MCQ quizzes from your content
- AI study guide with topic priority breakdown
- YouTube video recommendations per topic
- Dashboard tracking quiz scores and activity
- Multi-format support: PDF, DOCX, PPTX, TXT
- Streaming responses, dark/light mode, Google OAuth

---

## How it works

Documents are chunked and embedded using a local BGE model (no embedding API needed). On each query, hybrid retrieval (BM25 + semantic MMR) fetches candidates, a Flashrank cross-encoder re-ranks them, and Llama 3.1 8B on Groq generates the final answer.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, Vanilla CSS |
| Backend | FastAPI, LangChain |
| Embeddings | FastEmbed (BAAI/bge-small-en-v1.5, local) |
| Vector store | ChromaDB (per-user collections) |
| Retrieval | Hybrid BM25 + dense MMR + Flashrank re-ranking |
| LLM | Llama 3.1 8B via Groq |
| Auth | JWT + Google OAuth |
| Database | SQLite |
| Deployment | Render (backend), Vercel (frontend) |

---

## Local setup

**Prerequisites:** Python 3.11+, Node.js 20+, a free [Groq API key](https://console.groq.com)

**Backend**
```bash
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env    # add GROQ_API_KEY and JWT_SECRET
uvicorn main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev
```

---

## Environment variables

**Backend** (`.env`):

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Free at console.groq.com |
| `JWT_SECRET` | Yes | Any random string, 32+ chars |
| `GOOGLE_CLIENT_ID` | No | For Google OAuth |
| `YOUTUBE_API_KEY` | No | For video recommendations |

**Frontend** (`.env`):

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend URL |

---

## Deployment

Backend is deployed on Render (auto-deploys from GitHub). Frontend on Vercel. The free Render tier spins down after 15 minutes of inactivity — the first request after that takes ~30–50 seconds.

---

## License

MIT

# AskMyNotes 🎓

An AI-powered study assistant that lets you **ask questions about your own lecture notes** and get cited answers instantly.

🌐 **Live Demo:** [askmynotes.vercel.app](https://askmynotes.vercel.app)  
🔧 **Backend API:** [askmynotes-jt4o.onrender.com](https://askmynotes-jt4o.onrender.com)

---

## ✨ Features

- **📄 Multi-format Upload** — PDF, DOCX, PPTX, TXT (up to 20 MB)
- **💬 Q&A with Citations** — Ask anything; get answers grounded in your notes with page-level source references
- **⚡ Streaming Responses** — Answers stream token-by-token in real time
- **🧠 MCQ Quiz Generator** — Auto-generate 5-question quizzes from your notes with instant feedback
- **📚 Study Guide** — AI-generated topic breakdown with priority ranking and study tips
- **📺 YouTube Recommendations** — Relevant video suggestions per topic
- **📊 Dashboard** — Track quiz scores, questions asked, and activity over time
- **🌙 Dark / Light Mode**
- **🔐 Auth** — Email/password + Google OAuth

---

## 🏗️ Architecture

```
                        ┌─────────────────────────────────────┐
                        │           React (Vite)               │
                        │         Vercel Deployment            │
                        └────────────────┬────────────────────┘
                                         │ HTTPS
                        ┌────────────────▼────────────────────┐
                        │         FastAPI Backend              │
                        │         Render Deployment            │
                        │                                      │
                        │  ┌─────────────────────────────┐    │
                        │  │      Advanced RAG Pipeline   │    │
                        │  │                              │    │
                        │  │  Query                       │    │
                        │  │    ↓                         │    │
                        │  │  Hybrid Retrieval            │    │
                        │  │  ├─ BM25 (keyword, 40%)     │    │
                        │  │  └─ Dense MMR (semantic,60%) │    │
                        │  │    ↓                         │    │
                        │  │  Flashrank Re-ranking        │    │
                        │  │    ↓                         │    │
                        │  │  Llama 3.1 8B (Groq)        │    │
                        │  └─────────────────────────────┘    │
                        │                                      │
                        │  ChromaDB ── SQLite ── FastEmbed     │
                        └─────────────────────────────────────┘
```

### RAG Pipeline (Advanced RAG)

| Stage | Method | Detail |
|-------|--------|--------|
| **Chunking** | Recursive character split | 600 chars, 100 overlap |
| **Embeddings** | BGE-small-en-v1.5 (local) | Via FastEmbed, no API key |
| **Storage** | ChromaDB (per-user collections) | Isolated by email hash |
| **Retrieval** | Hybrid: BM25 (40%) + Dense MMR (60%) | Keyword + semantic |
| **Re-ranking** | Flashrank cross-encoder | Top 5 from 10 candidates |
| **Generation** | Llama 3.1 8B Instant (Groq) | Temperature 0, streaming |

---

## 🛠️ Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — API framework
- [LangChain](https://langchain.com/) — RAG orchestration
- [ChromaDB](https://www.trychroma.com/) — Vector store
- [FastEmbed](https://github.com/qdrant/fastembed) — Local embeddings (BAAI/bge-small-en-v1.5)
- [Groq](https://groq.com/) — LLM inference (Llama 3.1 8B)
- [Flashrank](https://github.com/PrithivirajDamodaran/FlashRank) — Cross-encoder re-ranking
- [rank_bm25](https://github.com/dorianbrown/rank_bm25) — BM25 keyword retrieval
- SQLite — User data, quiz scores, activity log

**Frontend**
- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- Vanilla CSS with dark mode
- Axios + Server-Sent Events (SSE) for streaming

**Infrastructure**
- Backend → [Render](https://render.com/) (free tier)
- Frontend → [Vercel](https://vercel.com/)
- CI → GitHub Actions

---

## 🚀 Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- [Groq API key](https://console.groq.com/) (free)

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Run the server
uvicorn main:app --reload
```

Visit `http://localhost:8000/health` → should return `{"status":"ok"}`

### Frontend

```bash
cd frontend

npm install

# Set API URL
echo "VITE_API_URL=http://localhost:8000" > .env

npm run dev
```

Visit `http://localhost:5173`

---

## 🔑 Environment Variables

### Backend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq API key — get one free at console.groq.com |
| `JWT_SECRET` | ✅ | Secret key for signing JWT tokens (any long random string) |
| `GOOGLE_CLIENT_ID` | ⚠️ Optional | For Google OAuth login |
| `CHROMA_DIR` | ❌ | ChromaDB path (default: `chroma_db`) |
| `DB_PATH` | ❌ | SQLite path (default: `askmynotes.db`) |

### Frontend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ | Backend URL (e.g. `https://askmynotes-jt4o.onrender.com`) |

---

## ☁️ Deployment

### Backend → Render
1. Push to GitHub
2. Create a new **Web Service** on Render → connect your repo
3. Set **Root Directory** to `backend`
4. Set **Build Command**: `pip install -r requirements.txt`
5. Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables: `GROQ_API_KEY`, `JWT_SECRET`
7. Deploy

### Frontend → Vercel
1. Import the repo on Vercel
2. Set **Root Directory** to `frontend`
3. Add environment variable: `VITE_API_URL=https://<your-render-url>`
4. Deploy

> **Note:** Render's free tier spins down after 15 min of inactivity. The first request after that takes ~30-50 seconds to wake up.

---

## 📁 Project Structure

```
askmynotes/
├── backend/
│   ├── main.py              # FastAPI app & all endpoints
│   ├── rag_pipeline.py      # Advanced RAG: hybrid search + re-ranking
│   ├── quiz.py              # MCQ quiz generation
│   ├── youtube_search.py    # YouTube video recommendations
│   ├── cloud_storage.py     # Cloudinary utilities (unused)
│   ├── auth/
│   │   ├── db.py            # SQLite: users, quiz scores, activity
│   │   ├── jwt_handler.py   # JWT create/decode
│   │   └── models.py        # Pydantic auth models
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/           # Upload, QnA, Quiz, Library, Dashboard
│   │   ├── components/      # Navbar, Sidebar, Toast, etc.
│   │   └── context/         # AuthContext, ThemeContext
│   └── package.json
└── .github/
    └── workflows/
        └── deploy.yml       # CI: install deps + run tests
```

---

## 📝 License

MIT

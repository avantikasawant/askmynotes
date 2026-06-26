# AskMyNotes

AskMyNotes is a RAG-based study assistant. Upload a lecture PDF and:
1. Ask questions about it and get answers with page citations.
2. Generate a 5-question MCQ quiz from the content.

## Architecture

```
┌────────────────┐      ┌──────────────────────┐      ┌───────────────┐
│   React UI      │ ───▶ │   FastAPI Backend     │ ───▶ │   ChromaDB     │
│ (Vite+Tailwind) │ ◀─── │ (LangChain + OpenAI)  │ ◀─── │ (vector store) │
└────────────────┘      └──────────────────────┘      └───────────────┘
```

- **Upload**: PDF is parsed with `PyPDFLoader`, split into 500-char chunks (50 overlap), embedded with OpenAI `text-embedding-3-small`, and stored in ChromaDB.
- **Ask**: User question is embedded, top-4 relevant chunks retrieved, answered by GPT-4o with page numbers returned.
- **Quiz**: Top chunks retrieved and sent to GPT-4o, which returns 5 MCQs as strict JSON.

## Screenshots

> _Add screenshots here_
- `docs/screenshot-upload.png`
- `docs/screenshot-qna.png`
- `docs/screenshot-quiz.png`

## Local Development

### Prerequisites
- Python 3.11
- Node.js 20
- Docker (optional, for containerized run)
- OpenAI API key

### Backend
```bash
cd backend
cp .env.example .env   # add your OPENAI_API_KEY
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Using Docker Compose
```bash
docker compose up --build
```

## Production Setup

### Backend (AWS EC2)
1. Provision an EC2 instance (Ubuntu, Docker installed).
2. Create `/home/<user>/askmynotes.env` with `OPENAI_API_KEY` and `ALLOWED_ORIGINS`.
3. Configure GitHub Secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`.
4. Push to `main` — GitHub Actions builds, pushes to Docker Hub, and redeploys via SSH.
5. Open port 8000 in the EC2 security group.

### Frontend (Vercel)
1. Import the `frontend` directory as a Vercel project.
2. Set environment variable `VITE_API_URL` to your EC2 backend's public URL.
3. Deploy.

## Environment Variables

| Variable          | Location  | Description                          |
|-------------------|-----------|---------------------------------------|
| `OPENAI_API_KEY`  | backend   | OpenAI API key                       |
| `ALLOWED_ORIGINS` | backend   | Comma-separated CORS origins         |
| `CHROMA_DIR`      | backend   | ChromaDB persistence path            |
| `VITE_API_URL`    | frontend  | Backend API base URL                 |

## Step-by-Step Setup Guide (Beginner)

### Step 1: Install prerequisites
- Install Python 3.11 from python.org
- Install Node.js 20 from nodejs.org
- Install Docker Desktop (optional)
- Get an OpenAI API key from platform.openai.com

### Step 2: Project files
Extract this project to a folder called `askmynotes`.

### Step 3: Set up the backend
1. Open a terminal in `askmynotes/backend`
2. Run: `cp .env.example .env`
3. Open `.env` and paste your OpenAI key after `OPENAI_API_KEY=`
4. Create a virtual environment:
   - `python -m venv venv`
   - Activate it: `source venv/bin/activate` (Mac/Linux) or `venv\Scripts\activate` (Windows)
5. Install dependencies: `pip install -r requirements.txt`
6. Start the server: `uvicorn main:app --reload`
7. Visit `http://localhost:8000/health` — you should see `{"status": "ok"}`

### Step 4: Set up the frontend
1. Open a new terminal in `askmynotes/frontend`
2. Run: `cp .env.example .env` (leave `VITE_API_URL=http://localhost:8000`)
3. Install dependencies: `npm install`
4. Start the dev server: `npm run dev`
5. Open the URL shown (usually `http://localhost:5173`)

### Step 5: Try it out
1. Go to the "Upload" tab and upload a PDF of lecture notes
2. Switch to "Ask Questions" and type a question — note the cited page numbers
3. Switch to "Quiz" and click "Generate 5 MCQs" — click an option to see if it's correct

### Step 6 (Optional): Run everything with Docker
1. From the project root: `docker compose up --build`
2. Backend runs on port 8000, frontend on port 5173

### Step 7: Deploy to production
1. Push your code to a GitHub repository
2. Set up an AWS EC2 instance with Docker installed
3. Add the required secrets in GitHub repo settings → Secrets and variables → Actions:
   - `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`
   - `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`
4. Push to the `main` branch — the GitHub Action will build and deploy automatically
5. Deploy the frontend to Vercel, setting `VITE_API_URL` to your EC2 backend URL

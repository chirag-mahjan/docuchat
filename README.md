# DocuChat — RAG Document Q&A & MCQ Quiz Generator

DocuChat allows users to upload documents (PDF, DOCX, TXT), ask grounded natural-language questions with clickable page citations, and auto-generate multiple-choice quizzes with explanations.

## Quick Start Guide

### 1. Prerequisites
- Docker & Docker Compose
- Python 3.12+
- Node.js 18+

### 2. Environment Setup
Copy `.env.example` to `.env` and enter your Groq API Key:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
```

### 3. Start Database & Cache (PostgreSQL + pgvector & Redis)
```bash
docker compose up -d
```

### 4. Run Backend Server
```bash
backend\venv\Scripts\python -m uvicorn app.main:app --reload --app-dir backend --port 8000
```
Backend API will be running at `http://localhost:8000`. API docs available at `http://localhost:8000/docs`.

Document ingestion and quiz generation run in background threads by default (no separate worker needed). To use Redis + RQ instead, start a worker and set `USE_RQ_WORKER=true`:
```bash
# terminal 1 — API
set USE_RQ_WORKER=false
backend\venv\Scripts\python -m uvicorn app.main:app --reload --app-dir backend --port 8000

# terminal 2 — RQ worker (only if USE_RQ_WORKER=true)
set PYTHONPATH=backend
backend\venv\Scripts\rq worker --url redis://localhost:6379/0 docuchat
```

### 5. Run Frontend Dev Server
```bash
cd frontend
npm run dev
```
Frontend will be running at `http://localhost:3000`.

### 6. Run Evaluation Harness
```bash
backend\venv\Scripts\python eval/eval_harness.py
```

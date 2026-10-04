# DocuChat — RAG Document Q&A Tool
### Technical Specification v1.0

---

## 1. Overview

**DocuChat** lets a user upload one or more documents (PDF, DOCX, TXT), then ask natural-language questions and get answers grounded in the document content, with clickable citations pointing back to the exact source passage.

**Goal of this project:** demonstrate embeddings, chunking strategy, retrieval quality, and grounded generation — not just "call an LLM with a prompt."

**Stack:** Python (FastAPI) backend, React (Vite) frontend, pgvector as the vector store.

---

## 2. Architecture

```
┌──────────────────┐        HTTP / SSE           ┌───────────────────────────┐
│   React Frontend  │ ─────────────────────────> │   FastAPI Backend         │
│   (Vite + TS)     │ <───────────────────────── │   (Port 8000)             │
└──────────────────┘                             └────────────┬──────────────┘
                                                                │
                                        ┌───────────────────────┼───────────────────────┐
                                        │                       │                       │
                                        ▼                       ▼                       ▼
                              ┌─────────────────┐    ┌────────────────────┐   ┌──────────────────┐
                              │ Ingestion Worker │    │  Postgres + pgvector│   │   LLM Provider    │
                              │ (Celery/RQ)      │    │  (chunks + metadata)│   │ (OpenAI / Groq /  │
                              │ parse → chunk →  │    │                    │   │  Ollama local)    │
                              │ embed → store    │    │                    │   │                   │
                              └─────────────────┘    └────────────────────┘   └──────────────────┘
```

**Why async ingestion:** parsing + embedding large PDFs can take seconds to minutes. Uploads are accepted immediately, processed in a background worker, and the frontend polls or subscribes to status (`uploaded → parsing → chunking → embedding → ready`).

---

## 3. Backend (Python / FastAPI)

### 3.1 Tech choices
| Concern | Choice | Why |
|---|---|---|
| API framework | FastAPI | async-native, typed request/response models via Pydantic |
| Background jobs | Celery + Redis (or RQ for simplicity) | ingestion is I/O + CPU heavy, must not block API |
| Document parsing | `pymupdf` (PDF), `python-docx` (DOCX), plain read (TXT) | reliable text + page-number extraction |
| Chunking | Recursive character/token splitter, ~600 tokens, 15% overlap | balances context completeness vs. retrieval precision |
| Embeddings | `text-embedding-3-small` (OpenAI) by default; pluggable `bge-small-en` via `sentence-transformers` for a local/free mode | shows both cloud and self-hosted capability |
| Vector store | Postgres + `pgvector` extension | avoids standing up a separate DB service; production-credible choice |
| Re-ranking (optional stretch) | cross-encoder (`ms-marco-MiniLM`) on top-k before final context assembly | improves precision, good talking point |
| LLM for answering | Pluggable: OpenAI GPT-4o-mini / Groq Llama 3.1 / local Ollama | mirrors Voxbrief's pluggable-provider pattern |

### 3.2 Data model

```sql
documents
  id UUID PK
  filename TEXT
  status TEXT  -- uploaded | parsing | chunking | embedding | ready | failed
  page_count INT
  created_at TIMESTAMP

chunks
  id UUID PK
  document_id UUID FK -> documents.id
  content TEXT
  page_number INT
  chunk_index INT
  embedding VECTOR(1536)   -- pgvector column

conversations
  id UUID PK
  title TEXT
  document_ids UUID[]      -- documents in scope for this chat
  created_at TIMESTAMP

messages
  id UUID PK
  conversation_id UUID FK
  role TEXT  -- user | assistant
  content TEXT
  citations JSONB           -- [{chunk_id, document_id, page_number, snippet}]
  created_at TIMESTAMP
```

### 3.3 Core API endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/documents` | Upload file(s), returns `document_id`, kicks off async ingestion |
| `GET` | `/documents/{id}` | Poll ingestion status |
| `GET` | `/documents` | List all uploaded documents |
| `POST` | `/conversations` | Create a conversation scoped to selected `document_ids` |
| `POST` | `/conversations/{id}/messages` | Ask a question; streams back answer (SSE) with citations |
| `GET` | `/conversations/{id}` | Fetch chat history |
| `DELETE` | `/documents/{id}` | Remove document + its chunks |

### 3.4 Retrieval + generation flow (per question)

1. Embed the user's question.
2. `SELECT` top-k chunks via cosine similarity (`pgvector` `<=>` operator), filtered to `document_ids` in scope.
3. *(Optional)* re-rank top-k with cross-encoder, keep top 4–6.
4. Assemble a grounded prompt:
   ```
   Answer ONLY using the context below. If the answer isn't in the
   context, say "I don't have enough information in these documents."
   Cite chunks you use by their [n] index.

   [1] {chunk text} (doc: X, page: Y)
   [2] {chunk text} (doc: X, page: Y)
   ...

   Question: {user question}
   ```
5. Stream the LLM response via SSE.
6. Parse `[n]` markers in the response, map back to `chunk_id`/`page_number`, return as structured `citations` alongside the streamed text.
7. Persist message + citations to `messages` table.

### 3.5 Guardrails
- If similarity scores for all retrieved chunks fall below a threshold, skip the LLM call and return "not found in documents" directly — avoids hallucinated answers and saves an API call.
- Token budget check before assembling context (truncate lowest-ranked chunks first if over budget).

---

## 4. Frontend (React + Vite)

### 4.1 Key views
- **Upload / Library view** — drag-and-drop upload, list of documents with status badges (Parsing… / Ready), multi-select checkboxes to scope a conversation.
- **Chat view** — streaming answer bubbles; each answer's citation markers `[1]`, `[2]` are clickable.
- **Source viewer panel** — clicking a citation opens a side panel with the source PDF page rendered (via `pdf.js` or `react-pdf`) and the relevant passage highlighted.
- **History sidebar** — list of past conversations.

### 4.2 State/data
- React Query (TanStack Query) for polling document status and fetching conversation history.
- `EventSource` (SSE) or `fetch` streaming for the live answer.
- No Redux needed at this scale — component state + React Query cache is sufficient.

---

## 5. Evaluation harness (differentiator)

A small `/eval` script, not part of the live app:
- A curated set of 15–25 question/expected-answer pairs against a fixed test document set.
- Metrics tracked:
  - **Retrieval recall@k** — is the "gold" chunk in the top-k retrieved?
  - **Answer correctness** — simple LLM-as-judge grading (correct / partially correct / incorrect) against expected answer.
- Run this after any change to chunking/embedding strategy and record results in `EVAL_RESULTS.md` — this is what shows you tested retrieval quality rather than assuming it works.

---

## 6. Deployment
- Docker Compose: `api`, `worker`, `redis`, `postgres` (with pgvector image), `frontend`.
- Environment config via `.env` (`OPENAI_API_KEY`, `GROQ_API_KEY`, `DATABASE_URL`).
- Single `docker compose up` to run the whole stack locally, matching the pattern used in Voxbrief.

---

## 7. Quiz Generation Feature (MCQs from documents)

### 7.1 Overview
In addition to Q&A chat, a user can generate a multiple-choice quiz from a selected document, choosing difficulty (`easy` / `medium` / `hard`) and question count. Each question includes 4 options, the correct answer, an explanation, and a citation back to the source chunk — reusing the same ingestion pipeline and citation mechanism already built for chat.

This is a second "consumption mode" over the same processed documents, not a new pipeline: no new parsing, chunking, or embedding logic is needed.

### 7.2 Data model additions

```sql
quizzes
  id UUID PK
  document_id UUID FK -> documents.id
  difficulty TEXT        -- easy | medium | hard | mixed
  question_count INT
  status TEXT             -- generating | ready | failed
  created_at TIMESTAMP

quiz_questions
  id UUID PK
  quiz_id UUID FK -> quizzes.id
  question TEXT
  options JSONB           -- ["option A", "option B", "option C", "option D"]
  correct_option_index INT
  explanation TEXT
  difficulty TEXT         -- easy | medium | hard (per-question, useful for "mixed" quizzes)
  source_chunk_id UUID FK -> chunks.id
  page_number INT
```

### 7.3 API endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/documents/{id}/quizzes` | Body: `{difficulty, question_count}`. Kicks off generation, returns `quiz_id` |
| `GET` | `/quizzes/{id}` | Poll status; returns full question set with answers once `ready` |
| `POST` | `/quizzes/{id}/grade` | Body: user's selected answers; returns per-question correct/incorrect + score |

### 7.4 Generation flow

1. **Chunk sampling** — unlike chat (which retrieves top-k for one specific question), quiz generation needs coverage across the whole document. Sample chunks spread evenly across the document (e.g., every Nth chunk, or one chunk per section if section boundaries are detected), rather than a similarity search.
2. **Per-chunk question generation** — for each sampled chunk, prompt the LLM to produce one question at the target difficulty, with structured JSON output validated against a Pydantic schema (same pattern as the ResumeScore project — schema-validated LLM output, not free text).
3. **Difficulty prompting** — give the model explicit, concrete criteria per level rather than just saying "make it hard," since naive difficulty prompting is a common failure point:
   - **Easy**: answerable from a single explicit sentence in the chunk; a direct fact-recall question.
   - **Medium**: requires combining two or more sentences within the same chunk/paragraph, or a light inference.
   - **Hard**: requires connecting information across two different chunks/sections of the document, or drawing a conclusion not explicitly stated.
4. **Deduplication pass** — check generated questions for near-duplicate phrasing (e.g., cosine similarity between question embeddings) and regenerate any that are too similar.
5. **Assembly** — combine all generated questions into the `quiz_questions` table, tagged with source chunk and page number for citation.
6. **Grading** — `/quizzes/{id}/grade` compares submitted answers to `correct_option_index`, returns a score plus each question's explanation (so it doubles as a study aid, not just a test).

### 7.5 Frontend additions
- **"Generate Quiz" button** on the document library view, opening a modal to pick difficulty and question count.
- **Quiz-taking view** — one question at a time or full-page list, radio-button options, a "Check answer" or "Submit quiz" flow depending on whether immediate or end-of-quiz feedback is preferred.
- **Results view** — score, per-question correct/incorrect, explanation, and a "Jump to source" link reusing the same source-viewer panel built for chat citations.

### 7.6 Guardrails
- If a sampled chunk is too short or low-information (e.g., a table of contents or header-only chunk), skip it and sample the next one rather than forcing a low-quality question.
- Cap `question_count` (e.g., max 25) to control generation time and cost.

---

## 8. Stretch goals (if time allows)
- Multi-document cross-referencing ("compare what doc A and doc B say about X").
- Swap-able embedding model benchmark (compare OpenAI vs. local `bge-small` on the eval harness).
- Auth + per-user document isolation.

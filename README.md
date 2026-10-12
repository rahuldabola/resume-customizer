# Resume Customizer

Paste a job description, upload a resume (PDF or DOCX), and get a version of that resume tailored to the job: a rewritten summary, JD-matching skills first, experience bullets reordered and rephrased in the JD's language, a list of missing keywords, and a before/after match score. Download the result as PDF, DOCX or TXT, and generate a matching cover letter.

**Live app:** https://resume-customizer-ai.vercel.app &nbsp;·&nbsp; **API:** https://resume-customizer-api.vercel.app/api/health

> No account needed. Click **Try with a sample** in the app to run it on a bundled fictional resume and JD.

## Features

**Core**
- Job description text area with validation (required, 100 to 15,000 characters, live counter).
- PDF / DOCX upload by drag-and-drop or file picker; shows file name and size. Type, size (4 MB, under Vercel's 4.5 MB request limit), empty-file, renamed-file (magic bytes) and scanned/image-only PDF checks on both client and server.
- Text extraction on the backend (`pdfplumber` for PDF; `python-docx` for DOCX, including table-based templates).
- LLM tailoring with Gemini: summary rewrite, skills reordering, experience/project bullets reordered and rephrased toward JD keywords, missing-keyword suggestions, and a "what changed and why" list.
- Clean resume preview, and download as **PDF, DOCX or TXT**.
- Clear error messages for invalid input, file problems, LLM rate limits/overload/timeouts, and network failures.

**Bonus (all implemented)**
- **Match score**: weighted JD keyword coverage before → after (must-haves count 3×).
- **Diff view**: per-section word diff; bullets are matched to their source bullet, so reordered bullets show as "moved from #3" instead of noise.
- **Multiple versions**: generate several versions (different tone or sections), switch between them, and **compare any two** side by side. History is kept in the browser.
- **Section-wise customization**: choose Summary, Skills, Experience, Projects. Unselected sections are copied byte-for-byte by the code, not the model.
- **Cover letter generator**, **streamed** token by token into the UI.
- **ATS score**: transparent heuristic checklist (contact info, standard sections, keyword coverage, action verbs, quantified bullets, bullet length, overall length), before and after.
- Writing style: Balanced / Concise / Impact-first.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, `diff`, `lucide-react` |
| Backend | Python 3.11, FastAPI, Pydantic v2, `pdfplumber`, `python-docx`, `fpdf2` |
| LLM | Google Gemini via the `google-genai` SDK: **`gemini-3.5-flash`** (primary), **`gemini-3.5-flash-lite`** (automatic fallback on 429/5xx) |
| Hosting | Vercel: Next.js frontend + FastAPI backend on the Python runtime (separate projects). A Dockerfile is included for Railway / Render / Cloud Run |
| Quality | pytest (39 tests, LLM mocked), ruff, ESLint, `tsc`, GitHub Actions CI |

## Architecture

```
┌──────────────────────── Next.js (Vercel) ────────────────────────┐
│ JD textarea · file drop · section/tone pickers · Try sample      │
│ Results: scores · tailored preview · diff · keywords/ATS ·       │
│          cover letter (streamed) · versions/compare · download   │
└───────────────┬──────────────────────────────────────────────────┘
                │ REST (multipart / JSON / text stream), CORS-restricted
┌───────────────▼──────────── FastAPI (Vercel Python) ─────────────┐
│ POST /api/customize                                              │
│   1. validate JD + file (type, magic bytes, size, text length)   │
│   2. extract text (pdfplumber / python-docx)                     │
│   3. LLM call #1 PARSE  (temp 0, cached): resume → structured    │
│      JSON verbatim + JD analysis (must-have / nice-to-have /     │
│      responsibilities / soft skills)                             │
│   4. LLM call #2 TAILOR (temp 0.4): rewrite selected sections    │
│   5. merge + guardrails (code, not prompt)                       │
│   6. deterministic match score + ATS score, before and after     │
│ POST /api/cover-letter → streamed plain text                     │
│ POST /api/export       → PDF / DOCX / TXT                        │
│ GET  /api/health                                                 │
└───────────────┬──────────────────────────────────────────────────┘
                │ structured output (JSON schema) / streaming
        ┌───────▼────────┐
        │ Google Gemini  │
        └────────────────┘
```

### LLM design and prompt engineering

- **Two calls, not one.** The first call converts the resume into a fixed JSON schema *verbatim* (temperature 0, minimal thinking) and extracts the JD's keywords. That gives a faithful "before" to diff and score against, and the result is cached (LRU), so extra versions cost one call instead of two.
- **Structured output.** Both calls use Gemini's `response_schema` with Pydantic models. Every field is required, so sections come back as `""`/`[]` rather than silently disappearing. Invalid JSON is retried once, then the next model is tried.
- **Truthfulness is enforced in code, not just requested in the prompt:**
  - Roles and projects are referenced by **index**; titles, companies and dates are copied from the parsed original, so the model cannot alter them.
  - A rewrite that **drops bullets** is rejected, and the original bullets are kept.
  - The **skills guard** removes any skill that never appears in the original resume (alias-aware, so "Postgres" → "PostgreSQL" is allowed) and restores skills the model dropped. Every intervention is shown to the user under "Guardrails applied".
- **Prompt content:** explicit truthfulness rules, per-section rules (summary length, no clichés or first person, action-verb + what + how + result bullets, tense by role), a keyword-coverage rule (use the JD's exact term when the original supports it, e.g. "OpenAI feature" → "LLM APIs (OpenAI)"), honest missing-keyword suggestions, and prompt-injection hardening (resume/JD text is wrapped in tags and treated as data).
- **Scores are deterministic.** The LLM only extracts JD keywords; matching is plain code (punctuation/plural/alias-aware, alternatives like "FastAPI / Flask / Django", partial credit for multi-word phrases), so the model cannot inflate its own score.

## Run locally

Prerequisites: Python 3.11+, Node 20+, a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
git clone https://github.com/rahuldabola/resume-customizer.git
cd resume-customizer

# Backend: http://localhost:8000
cd backend
python -m venv .venv
source .venv/bin/activate           # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                # then set GEMINI_API_KEY
uvicorn app.main:app --reload --port 8000

# Frontend: http://localhost:3000 (in a second terminal)
cd frontend
npm install
cp .env.example .env.local          # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Tests and checks:

```bash
cd backend && pytest -q && ruff check .        # LLM is mocked; no API key needed
cd frontend && npm run lint && npx tsc --noEmit && npm run build
```

Docker (backend): `docker build -t resume-api backend && docker run -p 8000:8000 --env-file backend/.env resume-api`

### Environment variables

| Where | Variable | Purpose |
|---|---|---|
| backend | `GEMINI_API_KEY` | Google AI Studio key (required) |
| backend | `GEMINI_MODELS` | Comma-separated model list, tried in order (default `gemini-3.5-flash,gemini-3.5-flash-lite`) |
| backend | `ALLOWED_ORIGINS` | Comma-separated CORS origins (the frontend URL) |
| backend | `MAX_UPLOAD_MB`, `RATE_LIMIT_PER_10MIN`, `LLM_TIMEOUT_S` | Optional limits (4 MB, 12 requests / 10 min per IP, 90 s) |
| frontend | `NEXT_PUBLIC_API_URL` | Backend base URL |

## Deployment

- **Backend → Vercel (Python runtime)**: project root `backend/`; `index.py` exposes the FastAPI `app`, `vercel.json` raises the function timeout to 120 s. Env vars: `GEMINI_API_KEY`, `ALLOWED_ORIGINS`. Deploy with `cd backend && vercel deploy --prod`.
- **Frontend → Vercel**: project root `frontend/`, `NEXT_PUBLIC_API_URL=https://resume-customizer-api.vercel.app`. Deploy with `cd frontend && vercel deploy --prod`.
- **Alternative**: `backend/Dockerfile` runs the same API on Railway, Render or Cloud Run, and installs DejaVu fonts so exported PDFs support full Unicode.

## Project structure

```
backend/
  index.py           Vercel entrypoint (re-exports app.main:app)
  app/main.py        API routes, validation, rate limiting, CORS
  app/parsing.py     PDF/DOCX → text (magic-byte checks, tables, list bullets)
  app/prompts.py     system prompts and prompt builders
  app/llm.py         Gemini client: structured JSON, streaming, model fallback, friendly errors
  app/pipeline.py    parse → tailor → merge with guardrails → score; parse cache
  app/scoring.py     deterministic JD match score and ATS heuristics
  app/export.py      PDF (fpdf2) / DOCX (python-docx) / TXT rendering
  app/schemas.py     Pydantic models shared by LLM, API and exporters
  tests/             39 tests (parsing, scoring, guardrails, API with mocked LLM)
frontend/
  src/components/    InputPanel, Workspace, ResumeView, DiffView, InsightsPanel, CoverLetter, Versions, ScoreCards
  src/lib/           API client (incl. stream reader), types, helpers
samples/             fictional sample resume + JD used by "Try with a sample" and the tests
```

## Known limitations and trade-offs

- **Scanned (image-only) PDFs** are rejected with a clear message; there is no OCR.
- **Layout is not preserved.** The download is a clean single-column ATS-friendly template, not the original design.
- **The ATS score is a heuristic.** Real ATS products differ; the checklist shows exactly what is measured. The match score is keyword-based, so it doesn't capture semantic similarity.
- **PDF fonts on Vercel.** The serverless runtime has no DejaVu font, so the PDF exporter falls back to Helvetica and transliterates non-Latin-1 characters (smart quotes, dashes). The Docker image has full Unicode; DOCX and TXT are always full Unicode.
- **Rate limiting is per instance.** The in-memory limiter is best-effort on serverless, where several instances may run.
- **No authentication or server-side storage.** By design, files are processed in memory and never stored; version history lives in the browser's localStorage only.
- **Free-tier Gemini quota.** Under load the primary model can return 503/429. The app falls back to `gemini-3.5-flash-lite`, and the UI explains if both are busy. There's a per-IP rate limit.
- **Tailor output is not streamed.** The main result is structured JSON that must be validated and guarded before display, so the UI shows staged progress instead. The cover letter *is* streamed.
- Education, certifications and other sections are not rewritten (only used as evidence), to avoid accidental changes to facts.

## AI tools used

Built with help from Claude Code (Anthropic) for scaffolding, code and tests; all design decisions, prompts and outputs were reviewed and tested manually against the sample and real resumes.

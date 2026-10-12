"""HTTP API for the Resume Customizer."""

import logging
import re
import time
from collections import defaultdict, deque
from threading import Lock
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from starlette.concurrency import run_in_threadpool

from . import llm, pipeline, prompts
from .config import JD_MAX_CHARS, JD_MIN_CHARS, RESUME_MAX_CHARS, RESUME_MIN_CHARS, settings
from .export import EXPORTERS
from .parsing import ResumeFileError, extract_resume_text
from .schemas import (
    ALL_SECTIONS,
    CoverLetterRequest,
    CustomizeResponse,
    ExportRequest,
    ResumeMeta,
    SectionName,
    Tone,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Resume Customizer API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


class _RateLimiter:
    """Per-client sliding window. In-memory is enough for a single instance; it protects the
    free-tier LLM quota from one user hammering the button."""

    def __init__(self, limit: int, window_s: int = 600) -> None:
        self.limit, self.window_s = limit, window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window_s:
                hits.popleft()
            if len(hits) >= self.limit:
                wait = int(self.window_s - (now - hits[0])) + 1
                raise HTTPException(429, f"Too many requests. Please try again in {wait} seconds.")
            hits.append(now)


limiter = _RateLimiter(settings.rate_limit_per_10min)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def _safe_filename(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_") or "resume"


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "models": settings.gemini_models, "commit": settings.commit}


@app.post("/api/customize", response_model=CustomizeResponse)
async def customize(
    request: Request,
    job_description: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
    sections: Annotated[str, Form()] = ",".join(ALL_SECTIONS),
    tone: Annotated[Tone, Form()] = "balanced",
) -> CustomizeResponse:
    jd_text = job_description.strip()
    if len(jd_text) < JD_MIN_CHARS:
        raise HTTPException(422, f"The job description is too short. Paste at least {JD_MIN_CHARS} characters.")
    if len(jd_text) > JD_MAX_CHARS:
        raise HTTPException(422, f"The job description is too long (max {JD_MAX_CHARS:,} characters).")

    chosen = [s.strip() for s in sections.split(",") if s.strip()]
    invalid = [s for s in chosen if s not in ALL_SECTIONS]
    if invalid or not chosen:
        raise HTTPException(422, f"Choose at least one section from: {', '.join(ALL_SECTIONS)}.")
    selected: list[SectionName] = [s for s in ALL_SECTIONS if s in chosen]

    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if not data:
        raise HTTPException(422, "The uploaded file is empty.")
    if len(data) > max_bytes:
        raise HTTPException(413, f"The file is larger than {settings.max_upload_mb} MB.")

    filename = file.filename or "resume"
    try:
        extracted = extract_resume_text(filename, data)
    except ResumeFileError as exc:
        raise HTTPException(422, str(exc)) from exc
    if len(extracted.text) < RESUME_MIN_CHARS:
        raise HTTPException(
            422,
            "Could not find enough text in this resume. If it is a scanned image, "
            "export it as a text-based PDF or DOCX.",
        )
    resume_text = extracted.text[:RESUME_MAX_CHARS]

    limiter.check(_client_ip(request))
    # The Gemini SDK is blocking; run it in the threadpool so the event loop stays free.
    try:
        parsed, parse_model = await run_in_threadpool(pipeline.parse, resume_text, jd_text)
        tailored_raw, model = await run_in_threadpool(
            pipeline.tailor, parsed.resume, parsed.jd, jd_text, selected, tone
        )
    except llm.LLMError as exc:
        raise HTTPException(502, str(exc)) from exc

    tailored, notes = pipeline.merge(parsed.resume, tailored_raw, selected)
    match, ats = pipeline.score(parsed.resume, tailored, parsed.jd)
    return CustomizeResponse(
        original=parsed.resume,
        tailored=tailored,
        jd=parsed.jd,
        match=match,
        ats=ats,
        missing_keywords=tailored_raw.missing_keywords,
        changes=tailored_raw.changes,
        guardrail_notes=notes,
        sections=selected,
        tone=tone,
        model=model,
        resume_meta=ResumeMeta(
            filename=filename, size_bytes=len(data), pages=extracted.pages, characters=len(resume_text)
        ),
    )


@app.post("/api/cover-letter")
def cover_letter(body: CoverLetterRequest, request: Request) -> StreamingResponse:
    limiter.check(_client_ip(request))
    prompt = prompts.cover_letter_prompt(body.resume, body.jd, body.job_description[:JD_MAX_CHARS])

    def stream():
        try:
            yield from llm.stream_text(prompts.COVER_LETTER_SYSTEM, prompt, temperature=0.6, thinking="low")
        except llm.LLMError as exc:
            # Headers are already sent, so report the failure in-band; the UI looks for this marker.
            yield f"\n\n[[ERROR]] {exc}"

    return StreamingResponse(stream(), media_type="text/plain; charset=utf-8", headers={"Cache-Control": "no-cache"})


@app.post("/api/export")
def export(body: ExportRequest) -> Response:
    render, media_type = EXPORTERS[body.format]
    filename = f"{_safe_filename(body.resume.name)}_tailored.{body.format}"
    return Response(
        content=render(body.resume),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

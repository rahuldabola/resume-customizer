"""API tests with the LLM replaced by canned responses, so they run offline and for free."""

import pytest
from fastapi.testclient import TestClient

from app import llm, main, pipeline
from app.schemas import JDAnalysis, ParseResult, TailoredEntry, TailorResult


@pytest.fixture
def client(monkeypatch, resume, jd):
    def fake_generate_json(system, prompt, schema, temperature, **kwargs):
        if schema is ParseResult:
            return ParseResult(resume=resume, jd=jd), "fake-model"
        return (
            TailorResult(
                headline="Full Stack Engineer",
                summary="Full stack engineer working in Python, React and PostgreSQL.",
                skills=resume.skills,
                experience=[TailoredEntry(index=0, bullets=list(reversed(resume.experience[0].bullets)))],
                projects=[],
                missing_keywords=[],
                changes=["Led with the LLM bullet."],
            ),
            "fake-model",
        )

    monkeypatch.setattr(llm, "generate_json", fake_generate_json)
    monkeypatch.setattr(llm, "stream_text", lambda *a, **k: iter(["Dear Hiring Manager,", " hello"]))
    monkeypatch.setattr(main, "limiter", main._RateLimiter(limit=100))
    pipeline.parse_cache._data.clear()
    return TestClient(main.app)


def _post(client, jd_text, file=("resume.pdf", b"", "application/pdf"), **form):
    return client.post("/api/customize", data={"job_description": jd_text, **form}, files={"file": file})


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_customize_end_to_end(client, sample_pdf, sample_jd):
    res = _post(client, sample_jd, ("resume.pdf", sample_pdf, "application/pdf"))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["tailored"]["summary"].startswith("Full stack engineer")
    assert body["original"]["summary"] == "Software engineer building web apps."
    assert body["resume_meta"]["filename"] == "resume.pdf"
    assert set(body["match"]) == {"before", "after"}
    assert body["sections"] == ["summary", "skills", "experience", "projects"]


@pytest.mark.parametrize(
    ("jd_text", "file", "status", "message"),
    [
        ("too short", None, 422, "too short"),
        ("x" * 200, ("resume.png", b"\x89PNG", "image/png"), 422, "Unsupported file type"),
        ("x" * 200, ("resume.pdf", b"", "application/pdf"), 422, "empty"),
    ],
)
def test_customize_validation(client, sample_pdf, jd_text, file, status, message):
    res = _post(client, jd_text, file or ("resume.pdf", sample_pdf, "application/pdf"))
    assert res.status_code == status
    assert message in res.json()["detail"]


def test_rejects_large_files(client, sample_jd, monkeypatch):
    big = b"%PDF" + b"0" * (4 * 1024 * 1024 + 10)
    res = _post(client, sample_jd, ("resume.pdf", big, "application/pdf"))
    assert res.status_code == 413


def test_rejects_unknown_sections(client, sample_pdf, sample_jd):
    res = _post(client, sample_jd, ("resume.pdf", sample_pdf, "application/pdf"), sections="hobbies")
    assert res.status_code == 422


def test_llm_failure_is_reported_as_502(client, sample_pdf, sample_jd, monkeypatch):
    def boom(*args, **kwargs):
        raise llm.LLMError("The AI service is rate-limited right now.")

    monkeypatch.setattr(llm, "generate_json", boom)
    res = _post(client, sample_jd, ("resume.pdf", sample_pdf, "application/pdf"))
    assert res.status_code == 502
    assert "rate-limited" in res.json()["detail"]


def test_rate_limit(client, sample_pdf, sample_jd, monkeypatch):
    monkeypatch.setattr(main, "limiter", main._RateLimiter(limit=1))
    file = ("resume.pdf", sample_pdf, "application/pdf")
    assert _post(client, sample_jd, file).status_code == 200
    assert _post(client, sample_jd, file).status_code == 429


@pytest.mark.parametrize("fmt", ["pdf", "docx", "txt"])
def test_export(client, resume, fmt):
    res = client.post("/api/export", json={"resume": resume.model_dump(), "format": fmt})
    assert res.status_code == 200
    assert "Aarav_Mehta_tailored" in res.headers["content-disposition"]
    assert res.content[:4] in {b"%PDF", b"PK\x03\x04"} or b"AARAV MEHTA" in res.content


def test_cover_letter_streams(client, resume, jd):
    payload = {"resume": resume.model_dump(), "jd": JDAnalysis.model_validate(jd).model_dump(), "job_description": "JD"}
    res = client.post("/api/cover-letter", json=payload)
    assert res.status_code == 200
    assert res.text == "Dear Hiring Manager, hello"

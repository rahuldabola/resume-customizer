import pytest

from app.scoring import ats_score, keyword_status, match_score


@pytest.mark.parametrize(
    ("keyword", "text", "expected"),
    [
        ("Python", "Built services in Python 3", "matched"),
        ("REST API", "Designed REST APIs", "matched"),  # plural
        ("Node.js", "Backend in NodeJS", "matched"),  # punctuation-insensitive
        ("PostgreSQL", "Wrote Postgres queries", "matched"),  # alias
        ("Postgres", "Wrote PostgreSQL queries", "matched"),  # reverse alias
        ("CI/CD", "Set up CI CD pipelines", "matched"),
        ("FastAPI / Flask / Django", "APIs in Flask", "matched"),  # alternatives
        ("JavaScript/TypeScript", "TypeScript and React", "matched"),
        ("Java", "JavaScript developer", "missing"),  # no substring false positive
        ("C++", "C and C# only", "missing"),
        ("design scalable APIs", "designed APIs for the team", "partial"),
        ("Kubernetes", "Docker only", "missing"),
    ],
)
def test_keyword_status(keyword, text, expected):
    assert keyword_status(keyword, text) == expected


def test_match_score_weights_must_haves(resume, jd):
    score = match_score(resume, jd)
    status = {k.keyword: k.status for k in score.keywords}
    assert status["Python"] == "matched"
    assert status["PostgreSQL"] == "matched"
    assert status["Kubernetes"] == "missing"
    assert 0 < score.score < 100


def test_match_score_improves_when_keyword_added(resume, jd):
    before = match_score(resume, jd).score
    resume.skills[0].items.append("Kubernetes")
    assert match_score(resume, jd).score > before


def test_ats_score_flags_missing_contact_and_sections(resume, jd):
    resume.contact = []
    resume.education = []
    result = ats_score(resume, match_score(resume, jd))
    checks = {c.label: c for c in result.checks}
    assert not checks["Contact details"].passed
    assert "Education" in checks["Standard sections"].detail
    assert 0 <= result.score <= 100

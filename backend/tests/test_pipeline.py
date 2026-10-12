from app.pipeline import merge
from app.schemas import SkillGroup, TailoredEntry, TailorResult


def _tailored(**overrides) -> TailorResult:
    base = {
        "headline": "Full Stack Engineer",
        "summary": "Full stack engineer with Python and React.",
        "skills": [SkillGroup(category="Core", items=["Python", "PostgreSQL", "React", "Docker"])],
        "experience": [
            TailoredEntry(
                index=0,
                bullets=[
                    "Cut handling time by 18% by integrating LLM APIs (OpenAI) for reply suggestions.",
                    "Developed REST APIs in Flask consumed by the mobile app.",
                ],
            )
        ],
        "projects": [TailoredEntry(index=0, bullets=["Built a RAG chatbot answering questions over PDFs."])],
        "missing_keywords": [],
        "changes": [],
    }
    base.update(overrides)
    return TailorResult(**base)


def test_merge_only_touches_selected_sections(resume):
    merged, _ = merge(resume, _tailored(), ["summary"])
    assert merged.summary.startswith("Full stack engineer")
    assert merged.headline == "Full Stack Engineer"
    assert merged.skills == resume.skills
    assert merged.experience[0].bullets == resume.experience[0].bullets


def test_merge_never_changes_titles_companies_or_dates(resume):
    merged, _ = merge(resume, _tailored(), ["experience", "projects"])
    role = merged.experience[0]
    assert (role.title, role.company, role.dates) == ("Software Engineer", "Brightpath", "Jan 2024 - Present")
    assert role.bullets[0].startswith("Cut handling time")


def test_skills_guard_removes_invented_skills_and_restores_dropped_ones(resume):
    tailored = _tailored(skills=[SkillGroup(category="Core", items=["Python", "Kubernetes", "PostgreSQL"])])
    merged, notes = merge(resume, tailored, ["skills"])
    items = [i for g in merged.skills for i in g.items]
    assert "Kubernetes" not in items  # never in the original resume
    assert "PostgreSQL" in items  # alias of the original "Postgres"
    assert "Postgres" not in items  # not duplicated under Additional Skills
    assert {"React", "Docker"} <= set(items)  # dropped by the model, restored
    assert any("Kubernetes" in n for n in notes)


def test_rewrite_that_drops_bullets_is_rejected(resume):
    tailored = _tailored(experience=[TailoredEntry(index=0, bullets=["Only one bullet left."])])
    merged, notes = merge(resume, tailored, ["experience"])
    assert merged.experience[0].bullets == resume.experience[0].bullets
    assert notes

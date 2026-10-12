"""Data shapes shared by the LLM layer, the API and the exporters.

Models that are sent to Gemini as a response schema avoid default values on purpose:
every field is required, so the model always returns the full shape and an empty
section comes back as "" or [] instead of being silently omitted.
"""

from typing import Literal

from pydantic import BaseModel, Field

SectionName = Literal["summary", "skills", "experience", "projects"]
ALL_SECTIONS: tuple[SectionName, ...] = ("summary", "skills", "experience", "projects")
Tone = Literal["balanced", "concise", "impact"]


class SkillGroup(BaseModel):
    category: str
    items: list[str]


class ExperienceItem(BaseModel):
    title: str
    company: str
    location: str
    dates: str
    bullets: list[str]


class ProjectItem(BaseModel):
    name: str
    subtitle: str
    bullets: list[str]


class EducationItem(BaseModel):
    degree: str
    institution: str
    dates: str
    details: str


class ExtraSection(BaseModel):
    title: str
    items: list[str]


class Resume(BaseModel):
    name: str
    headline: str
    contact: list[str]
    summary: str
    skills: list[SkillGroup]
    experience: list[ExperienceItem]
    projects: list[ProjectItem]
    education: list[EducationItem]
    extra_sections: list[ExtraSection]


class JDAnalysis(BaseModel):
    role_title: str
    company: str
    seniority: str
    must_have: list[str]
    nice_to_have: list[str]
    soft_skills: list[str]
    key_responsibilities: list[str]


class ParseResult(BaseModel):
    """Output of the first LLM call: the resume as structured data plus the JD analysis."""

    resume: Resume
    jd: JDAnalysis


class TailoredEntry(BaseModel):
    index: int
    bullets: list[str]


class MissingKeyword(BaseModel):
    keyword: str
    importance: Literal["must-have", "nice-to-have"]
    suggestion: str


class TailorResult(BaseModel):
    """Output of the second LLM call. Roles and projects are referenced by index so the
    model can only change bullets, never titles, companies or dates."""

    headline: str
    summary: str
    skills: list[SkillGroup]
    experience: list[TailoredEntry]
    projects: list[TailoredEntry]
    missing_keywords: list[MissingKeyword]
    changes: list[str]


# ---- API-only models (never sent to the LLM as a schema, so defaults are fine) ----


class KeywordHit(BaseModel):
    keyword: str
    category: Literal["must-have", "nice-to-have", "soft-skill", "responsibility"]
    status: Literal["matched", "partial", "missing"]


class MatchScore(BaseModel):
    score: int
    keywords: list[KeywordHit]


class AtsCheck(BaseModel):
    label: str
    passed: bool
    detail: str
    points: float
    max_points: float


class AtsScore(BaseModel):
    score: int
    checks: list[AtsCheck]


class ScorePair(BaseModel):
    before: MatchScore
    after: MatchScore


class AtsPair(BaseModel):
    before: AtsScore
    after: AtsScore


class ResumeMeta(BaseModel):
    filename: str
    size_bytes: int
    pages: int
    characters: int


class CustomizeResponse(BaseModel):
    original: Resume
    tailored: Resume
    jd: JDAnalysis
    match: ScorePair
    ats: AtsPair
    missing_keywords: list[MissingKeyword]
    changes: list[str]
    guardrail_notes: list[str]
    sections: list[SectionName]
    tone: Tone
    model: str
    resume_meta: ResumeMeta


class CoverLetterRequest(BaseModel):
    resume: Resume
    jd: JDAnalysis
    job_description: str = Field(min_length=1, max_length=20_000)


class ExportRequest(BaseModel):
    resume: Resume
    format: Literal["pdf", "docx", "txt"]

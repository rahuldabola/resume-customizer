"""The customize flow: parse -> tailor -> merge with guardrails -> score."""

import hashlib
import re
from collections import OrderedDict
from threading import Lock

from . import llm, prompts
from .schemas import (
    AtsPair,
    JDAnalysis,
    ParseResult,
    Resume,
    ScorePair,
    SectionName,
    SkillGroup,
    TailoredEntry,
    TailorResult,
    Tone,
)
from .scoring import ats_score, keyword_status, match_score, resume_to_text


class _ParseCache:
    """Small in-memory LRU so generating several versions for the same resume + JD
    costs one LLM call per version instead of two."""

    def __init__(self, size: int = 64) -> None:
        self._data: OrderedDict[str, ParseResult] = OrderedDict()
        self._size = size
        self._lock = Lock()

    def get(self, key: str) -> ParseResult | None:
        with self._lock:
            if key in self._data:
                self._data.move_to_end(key)
                return self._data[key]
            return None

    def put(self, key: str, value: ParseResult) -> None:
        with self._lock:
            self._data[key] = value
            self._data.move_to_end(key)
            while len(self._data) > self._size:
                self._data.popitem(last=False)


parse_cache = _ParseCache()


def parse(resume_text: str, job_description: str) -> tuple[ParseResult, str]:
    key = hashlib.sha256(f"{resume_text}\x00{job_description}".encode()).hexdigest()
    cached = parse_cache.get(key)
    if cached is not None:
        return cached, "cache"
    result, model = llm.generate_json(
        prompts.PARSE_SYSTEM,
        prompts.parse_prompt(resume_text, job_description),
        ParseResult,
        temperature=0.0,
        thinking="minimal",  # verbatim structuring needs no reasoning; keeps the call fast
    )
    parse_cache.put(key, result)
    return result, model


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9+#]", "", text.lower())


def _guard_skills(original: Resume, groups: list[SkillGroup], notes: list[str]) -> list[SkillGroup]:
    """Drop any skill the original resume never mentions, and re-add any original skill
    the model dropped, so the section can be reordered but not padded or trimmed."""
    source_text = resume_to_text(original)
    source = _norm(source_text)
    kept: list[SkillGroup] = []
    seen: set[str] = set()
    for group in groups:
        items = []
        for item in group.items:
            key = _norm(item)
            if not key or key in seen:
                continue
            # Accept exact mentions and known aliases (e.g. "PostgreSQL" for "Postgres").
            if key in source or keyword_status(item, source_text) == "matched":
                items.append(item)
                seen.add(key)
            else:
                notes.append(f'Removed "{item}" from Skills: it does not appear in your original resume.')
        if items:
            kept.append(SkillGroup(category=group.category, items=items))
    kept_text = "\n".join(i for g in kept for i in g.items)
    dropped = [
        i
        for g in original.skills
        for i in g.items
        if _norm(i) and _norm(i) not in seen and keyword_status(i, kept_text) != "matched"
    ]
    if dropped:
        kept.append(SkillGroup(category="Additional Skills", items=dropped))
    return kept or original.skills


def _merge_bullets(
    originals: list[list[str]], tailored: list[TailoredEntry], label: str, notes: list[str]
) -> list[list[str]]:
    by_index = {t.index: [b.strip() for b in t.bullets if b.strip()] for t in tailored}
    merged: list[list[str]] = []
    for i, bullets in enumerate(originals):
        new = by_index.get(i)
        if not new:
            merged.append(bullets)
        elif len(new) < len(bullets):
            # The prompt asks for every bullet back; losing content is worse than not tailoring.
            notes.append(f"Kept the original bullets for {label} #{i + 1}: the rewrite dropped some of them.")
            merged.append(bullets)
        else:
            merged.append(new)
    return merged


def merge(original: Resume, tailored: TailorResult, sections: list[SectionName]) -> tuple[Resume, list[str]]:
    notes: list[str] = []
    result = original.model_copy(deep=True)
    if "summary" in sections:
        result.headline = tailored.headline.strip() or original.headline
        result.summary = tailored.summary.strip() or original.summary
    if "skills" in sections and tailored.skills:
        result.skills = _guard_skills(original, tailored.skills, notes)
    if "experience" in sections:
        bullets = _merge_bullets([e.bullets for e in original.experience], tailored.experience, "role", notes)
        for item, new in zip(result.experience, bullets, strict=False):
            item.bullets = new
    if "projects" in sections:
        bullets = _merge_bullets([p.bullets for p in original.projects], tailored.projects, "project", notes)
        for item, new in zip(result.projects, bullets, strict=False):
            item.bullets = new
    return result, notes


def tailor(
    original: Resume, jd: JDAnalysis, job_description: str, sections: list[SectionName], tone: Tone
) -> tuple[TailorResult, str]:
    return llm.generate_json(
        prompts.TAILOR_SYSTEM,
        prompts.tailor_prompt(original, jd, job_description, sections, tone),
        TailorResult,
        temperature=0.4,
    )


def score(original: Resume, tailored: Resume, jd: JDAnalysis) -> tuple[ScorePair, AtsPair]:
    before, after = match_score(original, jd), match_score(tailored, jd)
    return ScorePair(before=before, after=after), AtsPair(
        before=ats_score(original, before), after=ats_score(tailored, after)
    )

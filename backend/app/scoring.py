"""Deterministic scoring.

The LLM extracts the JD keywords once; everything after that is plain code, so the
before/after numbers are reproducible and cannot be talked up by the model.
"""

import re
from functools import lru_cache

from .schemas import AtsCheck, AtsScore, JDAnalysis, KeywordHit, MatchScore, Resume

WEIGHTS = {"must-have": 3.0, "nice-to-have": 1.5, "responsibility": 1.0, "soft-skill": 0.75}

# Common spellings ATS systems treat as the same skill.
ALIASES: dict[str, list[str]] = {
    "javascript": ["js", "ecmascript"],
    "typescript": ["ts"],
    "kubernetes": ["k8s"],
    "postgresql": ["postgres"],
    "machine learning": ["ml"],
    "artificial intelligence": ["ai"],
    "large language models": ["llm", "llms"],
    "large language model": ["llm", "llms"],
    "natural language processing": ["nlp"],
    "amazon web services": ["aws"],
    "google cloud platform": ["gcp", "google cloud"],
    "ci/cd": ["continuous integration", "cicd", "ci cd"],
    "rest apis": ["rest api", "restful", "rest"],
    "rest api": ["rest apis", "restful", "rest"],
    "golang": ["go"],
    "next.js": ["nextjs"],
    "react": ["react.js", "reactjs"],
    "node.js": ["nodejs", "node"],
    "mongodb": ["mongo"],
}

STOPWORDS = {
    "and",
    "or",
    "the",
    "a",
    "an",
    "of",
    "to",
    "in",
    "on",
    "for",
    "with",
    "using",
    "use",
    "experience",
    "knowledge",
    "strong",
    "good",
    "skills",
    "ability",
    "years",
    "year",
    "plus",
    "including",
    "etc",
    "based",
    "working",
    "work",
    "understanding",
    "familiarity",
}

ACTION_VERB_HINT = re.compile(
    r"^(?:[A-Z][a-z]+(?:ed|ted|led|ied)|Built|Led|Ran|Won|Drove|Grew|Cut|Wrote|Made|Set|Shipped|"
    r"Owned|Spearheaded|Developed|Designed|Implemented|Created|Improved|Reduced|Increased|"
    r"Automated|Architected|Launched|Migrated|Optimized|Optimised|Delivered|Managed|Mentored|"
    r"Build|Lead|Develop|Design|Implement|Create|Improve|Reduce|Increase|Automate|Architect|"
    r"Launch|Migrate|Optimize|Optimise|Deliver|Manage|Mentor|Own|Drive|Write|Ship|Maintain|"
    r"Collaborate|Integrate|Deploy|Engineer|Establish|Streamline|Partner|Analy[sz]e)\b"
)
WEAK_OPENERS = re.compile(r"^(?:responsible for|worked on|helped|assisted|involved in|duties)", re.I)
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"\+?\d[\d\s().-]{8,}\d")


@lru_cache(maxsize=2048)
def _pattern(term: str) -> re.Pattern[str]:
    parts = [re.escape(p) for p in re.split(r"[\s./_-]+", term.lower()) if p]
    body = r"[\s./_-]*".join(parts)
    # Allow simple inflections ("API" -> "APIs", "design" -> "designed").
    return re.compile(rf"(?<![a-z0-9]){body}(?:s|es|ed|d|ing)?(?![a-z0-9+#])")


_REVERSE_ALIASES: dict[str, list[str]] = {}
for _canonical, _alts in ALIASES.items():
    for _alt in _alts:
        _REVERSE_ALIASES.setdefault(_alt, []).append(_canonical)


def _variants(keyword: str) -> list[str]:
    key = keyword.lower().strip()
    return [key, *ALIASES.get(key, []), *_REVERSE_ALIASES.get(key, [])]


def _tokens(keyword: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9+#]+", keyword.lower()) if t not in STOPWORDS and len(t) > 2]


def _alternatives(keyword: str) -> list[str]:
    """ "FastAPI / Flask / Django" or "Python or Go": any one of them satisfies the JD.
    A bare slash only splits between two words, so "CI/CD" and "TCP/IP" stay whole."""
    parts = re.split(r"\s+or\s+|,\s*|\s+/\s+|(?<=[A-Za-z]{3})/(?=[A-Za-z]{3})", keyword, flags=re.I)
    parts = [p.strip() for p in parts if p.strip()]
    return parts if len(parts) > 1 else [keyword]


def keyword_status(keyword: str, text: str) -> str:
    statuses = {_single_status(alt, text) for alt in _alternatives(keyword)}
    return "matched" if "matched" in statuses else "partial" if "partial" in statuses else "missing"


def _single_status(keyword: str, text: str) -> str:
    lowered = text.lower()
    if any(_pattern(v).search(lowered) for v in _variants(keyword)):
        return "matched"
    tokens = _tokens(keyword)
    # Multi-word phrases ("design scalable APIs") rarely appear verbatim: credit partial coverage.
    # Two-word terms ("React Native") are atomic skills, so half a match would mislead.
    if len(tokens) >= 3:
        found = sum(1 for t in tokens if _pattern(t).search(lowered))
        if found == len(tokens):
            return "matched"
        if found / len(tokens) >= 0.5:
            return "partial"
    return "missing"


def _jd_keywords(jd: JDAnalysis) -> list[tuple[str, str]]:
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for category, items in (
        ("must-have", jd.must_have),
        ("nice-to-have", jd.nice_to_have),
        ("responsibility", jd.key_responsibilities),
        ("soft-skill", jd.soft_skills),
    ):
        for item in items:
            key = item.strip().lower()
            if key and key not in seen:
                seen.add(key)
                out.append((item.strip(), category))
    return out


def resume_to_text(resume: Resume) -> str:
    lines = [resume.name, resume.headline, " | ".join(resume.contact), resume.summary]
    for group in resume.skills:
        lines.append(f"{group.category}: {', '.join(group.items)}")
    for e in resume.experience:
        lines.append(f"{e.title} {e.company} {e.location} {e.dates}")
        lines.extend(e.bullets)
    for p in resume.projects:
        lines.append(f"{p.name} {p.subtitle}")
        lines.extend(p.bullets)
    for ed in resume.education:
        lines.append(f"{ed.degree} {ed.institution} {ed.dates} {ed.details}")
    for s in resume.extra_sections:
        lines.append(s.title)
        lines.extend(s.items)
    return "\n".join(line for line in lines if line and line.strip())


def match_score(resume: Resume, jd: JDAnalysis) -> MatchScore:
    text = resume_to_text(resume)
    hits: list[KeywordHit] = []
    earned = total = 0.0
    for keyword, category in _jd_keywords(jd):
        status = keyword_status(keyword, text)
        weight = WEIGHTS[category]
        total += weight
        earned += weight * {"matched": 1.0, "partial": 0.5, "missing": 0.0}[status]
        hits.append(KeywordHit(keyword=keyword, category=category, status=status))  # type: ignore[arg-type]
    score = round(100 * earned / total) if total else 0
    return MatchScore(score=score, keywords=hits)


def _check(label: str, ratio: float, max_points: float, detail: str, pass_at: float = 0.8) -> AtsCheck:
    ratio = max(0.0, min(1.0, ratio))
    return AtsCheck(
        label=label,
        passed=ratio >= pass_at,
        detail=detail,
        points=round(ratio * max_points, 1),
        max_points=max_points,
    )


def ats_score(resume: Resume, match: MatchScore) -> AtsScore:
    """Heuristic ATS-friendliness estimate (0-100). Real ATS products differ; this checks the
    things most of them reward: parseable contact info, standard sections, keyword coverage
    and well-formed, quantified bullets."""
    contact = " ".join(resume.contact)
    has_email, has_phone = bool(EMAIL.search(contact)), bool(PHONE.search(contact))
    checks = [
        _check(
            "Contact details",
            (has_email + has_phone) / 2,
            10,
            "Email and phone found"
            if has_email and has_phone
            else "Add "
            + " and ".join(x for x, ok in (("an email", has_email), ("a phone number", has_phone)) if not ok),
            pass_at=1.0,
        )
    ]

    present = {
        "Summary": bool(resume.summary.strip()),
        "Skills": any(g.items for g in resume.skills),
        "Experience": bool(resume.experience),
        "Education": bool(resume.education),
    }
    missing = [name for name, ok in present.items() if not ok]
    checks.append(
        _check(
            "Standard sections",
            sum(present.values()) / len(present),
            15,
            "Summary, Skills, Experience and Education present" if not missing else f"Missing: {', '.join(missing)}",
            pass_at=1.0,
        )
    )

    checks.append(
        _check("JD keyword coverage", match.score / 100, 35, f"{match.score}% of weighted JD keywords found", 0.7)
    )

    bullets = [b for e in resume.experience for b in e.bullets] + [b for p in resume.projects for b in p.bullets]
    n = len(bullets) or 1
    strong = sum(1 for b in bullets if ACTION_VERB_HINT.match(b.strip()) and not WEAK_OPENERS.match(b.strip()))
    quantified = sum(1 for b in bullets if re.search(r"\d", b))
    well_sized = sum(1 for b in bullets if 8 <= len(b.split()) <= 35)
    checks.append(
        _check("Action-verb bullets", strong / n, 15, f"{strong} of {len(bullets)} bullets open with an action verb")
    )
    checks.append(
        _check(
            "Quantified impact",
            quantified / n / 0.5,
            15,
            f"{quantified} of {len(bullets)} bullets include a number (aim for half)",
        )
    )
    checks.append(_check("Bullet length", well_sized / n, 5, f"{well_sized} of {len(bullets)} bullets are 8-35 words"))

    words = len(resume_to_text(resume).split())
    length_ok = 250 <= words <= 1100
    checks.append(
        _check(
            "Overall length",
            1.0 if length_ok else 0.4,
            5,
            f"{words} words" + ("" if length_ok else " (aim for roughly 1-2 pages: 250-1100 words)"),
            pass_at=1.0,
        )
    )
    score = round(sum(c.points for c in checks))
    return AtsScore(score=min(100, score), checks=checks)

"""Runtime settings, read once from the environment (and a local .env in development)."""

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _csv(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    # Tried in order; the next model is used when one is overloaded or rate-limited.
    gemini_models: list[str] = field(
        default_factory=lambda: _csv("GEMINI_MODELS", "gemini-3.5-flash,gemini-3.5-flash-lite")
    )
    llm_timeout_s: int = field(default_factory=lambda: int(os.getenv("LLM_TIMEOUT_S", "90")))
    allowed_origins: list[str] = field(default_factory=lambda: _csv("ALLOWED_ORIGINS", "http://localhost:3000"))
    max_upload_mb: int = field(default_factory=lambda: int(os.getenv("MAX_UPLOAD_MB", "5")))
    rate_limit_per_10min: int = field(default_factory=lambda: int(os.getenv("RATE_LIMIT_PER_10MIN", "12")))
    commit: str = field(default_factory=lambda: os.getenv("RAILWAY_GIT_COMMIT_SHA", "local")[:7])


settings = Settings()

JD_MIN_CHARS = 100
JD_MAX_CHARS = 15_000
RESUME_MIN_CHARS = 200
RESUME_MAX_CHARS = 30_000

"""Thin wrapper around the Gemini SDK: structured JSON calls, text streaming and model fallback."""

import logging
from collections.abc import Iterator
from typing import TypeVar

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from .config import settings

log = logging.getLogger(__name__)
# The SDK warns on every structured response that carries a thought signature; it is harmless.
logging.getLogger("google_genai.types").setLevel(logging.ERROR)

T = TypeVar("T", bound=BaseModel)

# Status codes worth retrying on a different model: rate limits, overload, upstream hiccups.
_FALLBACK_CODES = {429, 500, 502, 503, 504}


class LLMError(RuntimeError):
    """Raised with a message that is safe to show to the user."""


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if not settings.gemini_api_key:
        raise LLMError("The server has no GEMINI_API_KEY configured.")
    if _client is None:
        _client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(timeout=settings.llm_timeout_s * 1000),
        )
    return _client


def _friendly(exc: Exception) -> LLMError:
    if isinstance(exc, errors.APIError) and exc.code == 429:
        return LLMError("The AI service is rate-limited right now. Please wait a minute and try again.")
    if isinstance(exc, errors.APIError) and exc.code in (500, 502, 503, 504):
        return LLMError("The AI service is temporarily overloaded. Please try again in a moment.")
    return LLMError("The AI service failed to respond. Please try again.")


def _text(response: types.GenerateContentResponse) -> str:
    """Join the answer's text parts, skipping thinking parts (reading `.text` directly logs a
    warning on every call when the model returns a thought signature)."""
    if not response.candidates or not response.candidates[0].content:
        return ""
    parts = response.candidates[0].content.parts or []
    return "".join(p.text for p in parts if p.text and not p.thought)


def _config(system: str, temperature: float, thinking: str | None, **extra) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=system,
        temperature=temperature,
        thinking_config=types.ThinkingConfig(thinking_level=thinking) if thinking else None,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        **extra,
    )


def generate_json(
    system: str, prompt: str, schema: type[T], temperature: float, thinking: str | None = None
) -> tuple[T, str]:
    """Return a validated `schema` instance and the name of the model that produced it.
    `thinking` is a Gemini thinking level ("minimal", "low", ...); None keeps the model default."""
    client = _get_client()
    config = _config(system, temperature, thinking, response_mime_type="application/json", response_schema=schema)
    last_exc: Exception | None = None
    for model in settings.gemini_models:
        # One extra attempt per model when the JSON does not validate.
        for attempt in range(2):
            try:
                response = client.models.generate_content(model=model, contents=prompt, config=config)
                return schema.model_validate_json(_text(response)), model
            except ValidationError as exc:
                log.warning("model %s returned invalid JSON (attempt %d): %s", model, attempt + 1, exc)
                last_exc = exc
            except errors.APIError as exc:
                log.warning("model %s failed with %s: %s", model, exc.code, exc.message)
                last_exc = exc
                if exc.code not in _FALLBACK_CODES:
                    raise _friendly(exc) from exc
                break  # try the next model
            except Exception as exc:  # timeouts and transport errors
                log.warning("model %s transport error: %r", model, exc)
                last_exc = exc
                break
    raise _friendly(last_exc or RuntimeError("no models configured")) from last_exc


def stream_text(system: str, prompt: str, temperature: float, thinking: str | None = None) -> Iterator[str]:
    """Yield text chunks as they arrive. Falls back to the next model only if the
    first chunk never arrived, since a half-streamed answer cannot be retried cleanly."""
    client = _get_client()
    config = _config(system, temperature, thinking)
    last_exc: Exception | None = None
    for model in settings.gemini_models:
        started = False
        try:
            for chunk in client.models.generate_content_stream(model=model, contents=prompt, config=config):
                text = _text(chunk)
                if text:
                    started = True
                    yield text
            return
        except Exception as exc:
            log.warning("streaming with %s failed: %r", model, exc)
            last_exc = exc
            if started:
                raise _friendly(exc) from exc
    raise _friendly(last_exc or RuntimeError("no models configured")) from last_exc

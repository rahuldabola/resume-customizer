"""Entrypoint for Vercel's Python runtime, which looks for an `app` object in index.py."""

from app.main import app

__all__ = ["app"]

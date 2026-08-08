#!/usr/bin/env python3
"""OpenAI-compatible semantic embedding provider boundary for the RAG stack."""

from __future__ import annotations

import json
import math
import os
import ssl
import http.client
import urllib.error
import urllib.request
from dataclasses import dataclass, field


try:
    import certifi
except ImportError:
    certifi = None

try:
    from pgvector import Vector
except ImportError:
    Vector = None


DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "text-embedding-3-small"
SCHEMA_EMBEDDING_DIMENSIONS = 1536
DEFAULT_TIMEOUT_SECONDS = 30
HTTPS_CONTEXT = ssl.create_default_context(cafile=certifi.where()) if certifi else None


class EmbeddingUnavailable(RuntimeError):
    """The configured provider could not return a usable embedding."""


@dataclass(frozen=True)
class EmbeddingSettings:
    api_key: str = field(repr=False)
    base_url: str
    model: str
    dimensions: int


def _dimension_error():
    return ValueError(
        "RAG_EMBEDDING_DIMENSIONS must be 1536 until a schema migration and re-index are completed"
    )


def load_embedding_settings(environ=None):
    """Load optional provider configuration without making a network request."""
    values = os.environ if environ is None else environ
    api_key = str(values.get("RAG_EMBEDDING_API_KEY", "")).strip()
    if not api_key:
        return None

    try:
        dimensions = int(values.get("RAG_EMBEDDING_DIMENSIONS", SCHEMA_EMBEDDING_DIMENSIONS))
    except (TypeError, ValueError) as exc:
        raise _dimension_error() from exc
    if dimensions != SCHEMA_EMBEDDING_DIMENSIONS:
        raise _dimension_error()

    base_url = str(values.get("RAG_EMBEDDING_BASE_URL", DEFAULT_BASE_URL) or DEFAULT_BASE_URL).strip().rstrip("/")
    model = str(values.get("RAG_EMBEDDING_MODEL", DEFAULT_MODEL) or DEFAULT_MODEL).strip()
    return EmbeddingSettings(
        api_key=api_key,
        base_url=base_url,
        model=model,
        dimensions=dimensions,
    )


def validate_embedding_vector(vector):
    """Return a safe, schema-compatible copy of a provider vector."""
    if not isinstance(vector, (list, tuple)):
        raise ValueError("embedding response must contain a numeric vector")
    if len(vector) != SCHEMA_EMBEDDING_DIMENSIONS:
        raise ValueError(
            f"embedding response expected {SCHEMA_EMBEDDING_DIMENSIONS} values, got {len(vector)}"
        )

    normalized = []
    for value in vector:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError("embedding response must contain only finite numeric values")
        normalized.append(float(value))
    return normalized


def _provider_payload(response):
    try:
        payload = json.loads(response.read().decode("utf-8"))
    except (AttributeError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise EmbeddingUnavailable("embedding provider returned invalid JSON") from exc

    if not isinstance(payload, dict) or payload.get("error"):
        raise EmbeddingUnavailable("embedding provider returned an error response")
    data = payload.get("data")
    if not isinstance(data, list) or len(data) != 1 or not isinstance(data[0], dict):
        raise EmbeddingUnavailable("embedding provider must return exactly one embedding")
    if "embedding" not in data[0]:
        raise EmbeddingUnavailable("embedding provider response is missing an embedding")
    return data[0]["embedding"]


def embed_text(text, settings, *, urlopen=None, timeout=DEFAULT_TIMEOUT_SECONDS):
    """Embed text through the configured OpenAI-compatible provider."""
    if settings is None or not str(settings.api_key or "").strip():
        raise EmbeddingUnavailable("RAG_EMBEDDING_API_KEY is not configured")
    if settings.dimensions != SCHEMA_EMBEDDING_DIMENSIONS:
        raise _dimension_error()

    body = json.dumps(
        {
            "input": str(text),
            "model": settings.model,
            "dimensions": settings.dimensions,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{settings.base_url.rstrip('/')}/embeddings",
        data=body,
        headers={
            "Authorization": f"Bearer {settings.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    opener = urlopen or urllib.request.urlopen

    try:
        with opener(request, timeout=timeout, context=HTTPS_CONTEXT) as response:
            status = getattr(response, "status", None)
            if status is None and hasattr(response, "getcode"):
                status = response.getcode()
            if status is not None and not 200 <= int(status) < 300:
                raise EmbeddingUnavailable(f"embedding provider returned HTTP {status}")
            vector = _provider_payload(response)
    except EmbeddingUnavailable:
        raise
    except (http.client.HTTPException, urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as exc:
        raise EmbeddingUnavailable("embedding provider is unavailable") from exc

    return validate_embedding_vector(vector)


def semantic_vector(vector):
    """Adapt a validated vector for pgvector when its Python adapter is installed."""
    validated = validate_embedding_vector(vector)
    return Vector(validated) if Vector is not None else validated

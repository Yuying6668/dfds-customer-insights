"""Safe hybrid evidence retrieval query construction and result ranking."""

from __future__ import annotations

import math
from collections.abc import Iterable, Mapping
from typing import Any


ALLOWED_SOURCE_TIERS = ["public_snapshot", "synthetic_demo"]
KNOWN_ROUTE_KEYS = frozenset(
    {
        "all",
        "dover-calais",
        "newhaven-dieppe",
        "newcastle-ijmuiden",
        "jersey",
    }
)
REVIEW_EVIDENCE_KINDS = {"app_review", "raw_review_chunk"}


def _text(value: object) -> str:
    return str(value or "").strip()


def _route_key(value: object) -> str:
    return _text(value).lower() or "all"


def _finite_float(value: object, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if math.isfinite(number) else default


def _as_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes"}
    return bool(value)


def _metadata(value: object) -> dict[str, Any]:
    return dict(value) if isinstance(value, Mapping) else {}


def _safe_limit(value: object) -> int:
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return 1


def _keyword_score_expression(terms: list[str]) -> str:
    if not terms:
        return "0.0"

    search_blob = (
        "lower(concat_ws(' ', e.evidence_kind, e.original_content, "
        "e.translated_content, array_to_string(e.keywords, ' '), "
        "s.name, c.name, r.display_name, e.metadata::text))"
    )
    return " + ".join(
        f"CASE WHEN {search_blob} LIKE %(term_{position})s THEN 1 ELSE 0 END"
        for position in range(len(terms))
    )


def build_hybrid_evidence_query(
    terms: Iterable[object],
    requested_route: object,
    semantic_available: bool,
    limit: int,
) -> tuple[str, dict[str, object]]:
    """Build a parameterized evidence candidate query.

    User-derived terms and routes are values in ``params``. SQL text contains
    only fixed fragments and parameter names generated from term positions.
    """

    normalized_terms = [_text(term).lower() for term in terms if _text(term)]
    route = _route_key(requested_route)
    params: dict[str, object] = {
        "allowed_source_tiers": list(ALLOWED_SOURCE_TIERS),
        "requested_route": route,
        "limit": _safe_limit(limit),
    }
    for position, term in enumerate(normalized_terms):
        params[f"term_{position}"] = f"%{term}%"

    where_parts = ["e.source_tier = ANY(%(allowed_source_tiers)s)"]
    if route in KNOWN_ROUTE_KEYS and route != "all":
        where_parts.append(
            "(r.route_key = %(route_key)s OR r.route_key = 'all' OR r.route_key IS NULL)"
        )
        params["route_key"] = route

    keyword_score = _keyword_score_expression(normalized_terms)
    if semantic_available:
        semantic_score = "1 - (e.semantic_embedding <=> %(semantic_embedding)s) AS semantic_score"
        candidate_filter = ""
    else:
        semantic_score = "0.0 AS semantic_score"
        # Match the existing keyword-only behavior: do not return an unrelated
        # row merely because route or source boosts give it a positive total.
        candidate_filter = "WHERE keyword_score > 0"

    sql = f"""
        WITH scored_evidence AS (
          SELECT
            e.id,
            e.evidence_kind,
            e.original_content AS body,
            e.translated_content,
            e.rating,
            e.review_count,
            e.published_at,
            e.url,
            e.metadata,
            e.keywords,
            e.source_tier,
            e.is_synthetic,
            e.source_version,
            s.name AS source_name,
            c.name AS company_name,
            r.display_name AS route_name,
            COALESCE(r.route_key, 'all') AS route_key,
            ({keyword_score}) AS keyword_score,
            {semantic_score},
            CASE
              WHEN COALESCE(r.route_key, 'all') = %(requested_route)s THEN 0.16
              WHEN COALESCE(r.route_key, 'all') = 'all' THEN 0.04
              ELSE 0.0
            END AS route_boost,
            CASE WHEN e.source_tier = 'public_snapshot' THEN 0.08 ELSE 0.03 END AS source_boost,
            CASE
              WHEN e.evidence_kind IN ('app_review', 'raw_review_chunk') THEN 0.04
              ELSE 0.0
            END AS type_boost
          FROM evidence_items e
          JOIN sources s ON s.id = e.source_id
          LEFT JOIN companies c ON c.id = e.company_id
          LEFT JOIN routes r ON r.id = e.route_id
          WHERE {' AND '.join(where_parts)}
        )
        SELECT
          scored_evidence.*,
          (
            LEAST(keyword_score / 6.0, 1.0) * 0.35
            + GREATEST(COALESCE(semantic_score, 0.0), 0.0) * 0.55
            + route_boost
            + source_boost
            + type_boost
          ) AS hybrid_score
        FROM scored_evidence
        {candidate_filter}
        ORDER BY hybrid_score DESC, route_boost DESC, id DESC
        LIMIT %(limit)s
    """
    return sql, params


def _score_components(row: Mapping[str, object], requested_route: object | None) -> dict[str, float]:
    item_route = _route_key(row.get("route_key"))
    if requested_route is None:
        route_boost = _finite_float(row.get("route_boost"))
    else:
        requested = _route_key(requested_route)
        route_boost = 0.16 if item_route == requested else 0.04 if item_route == "all" else 0.0

    source_tier = _text(row.get("source_tier")) or "public_snapshot"
    source_boost = 0.08 if source_tier == "public_snapshot" else 0.03
    evidence_kind = _text(row.get("evidence_kind") or row.get("type"))
    type_boost = 0.04 if evidence_kind in REVIEW_EVIDENCE_KINDS else 0.0
    keyword_score = min(_finite_float(row.get("keyword_score")) / 6.0, 1.0)
    semantic_score = max(_finite_float(row.get("semantic_score")), 0.0)
    hybrid_score = keyword_score * 0.35 + semantic_score * 0.55 + route_boost + source_boost + type_boost

    return {
        "keywordScore": round(keyword_score, 4),
        "semanticScore": round(semantic_score, 4),
        "routeBoost": route_boost,
        "sourceBoost": source_boost,
        "typeBoost": type_boost,
        "hybridScore": round(hybrid_score, 4),
    }


def _normalized_score_components(
    row: Mapping[str, object], score_components: Mapping[str, object] | None
) -> dict[str, float]:
    if score_components is None:
        supplied = row.get("scoreComponents") or row.get("score_components")
        score_components = supplied if isinstance(supplied, Mapping) else None
    if score_components is None:
        return _score_components(row, None)

    return {
        "keywordScore": round(
            _finite_float(score_components.get("keywordScore", score_components.get("keyword_score"))), 4
        ),
        "semanticScore": round(
            _finite_float(score_components.get("semanticScore", score_components.get("semantic_score"))), 4
        ),
        "routeBoost": _finite_float(score_components.get("routeBoost", score_components.get("route_boost"))),
        "sourceBoost": _finite_float(score_components.get("sourceBoost", score_components.get("source_boost"))),
        "typeBoost": _finite_float(score_components.get("typeBoost", score_components.get("type_boost"))),
        "hybridScore": round(
            _finite_float(score_components.get("hybridScore", score_components.get("hybrid_score"))), 4
        ),
    }


def normalize_evidence_row(
    row: Mapping[str, object], *, score_components: Mapping[str, object] | None = None
) -> dict[str, object]:
    """Convert a database candidate row to the existing camel-case evidence API shape."""

    metadata = _metadata(row.get("metadata"))
    evidence_kind = _text(row.get("evidence_kind") or row.get("type")) or "evidence"
    source_tier = _text(row.get("source_tier")) or "public_snapshot"
    source_version = _text(row.get("source_version")) or "legacy-v1"
    body = _text(row.get("body") or row.get("original_content"))
    rating = row.get("rating")

    return {
        "id": row.get("id", ""),
        "type": evidence_kind,
        "title": (
            metadata.get("theme")
            or metadata.get("title")
            or metadata.get("location")
            or _text(row.get("title"))
            or evidence_kind
        ),
        "body": body,
        "translatedContent": row.get("translated_content") or row.get("translatedContent"),
        "source": row.get("source_name") or row.get("source") or "",
        "company": row.get("company_name") or row.get("company") or "",
        "route": row.get("route_name") or row.get("route") or "All signals",
        "routeKey": _route_key(row.get("route_key") or row.get("routeKey")),
        "rating": _finite_float(rating) if rating is not None else None,
        "reviewCount": row.get("review_count") or row.get("reviewCount"),
        "timestamp": str(row.get("published_at") or row.get("timestamp") or ""),
        "url": row.get("url") or "",
        "metadata": metadata,
        "keywords": list(row.get("keywords") or []),
        "textScore": _finite_float(row.get("keyword_score", row.get("textScore"))),
        "distance": row.get("distance"),
        "sourceTier": source_tier,
        "isSynthetic": _as_bool(row.get("is_synthetic", row.get("isSynthetic"))),
        "sourceVersion": source_version,
        "scoreComponents": _normalized_score_components(row, score_components),
    }


def _route_preference(item: Mapping[str, object], requested_route: object) -> int:
    item_route = _route_key(item.get("routeKey") or item.get("route_key"))
    requested = _route_key(requested_route)
    if item_route == requested:
        return 2
    return 1 if item_route == "all" else 0


def rank_evidence_rows(
    rows: Iterable[Mapping[str, object]], requested_route: object, limit: int | None = None
) -> list[dict[str, object]]:
    """Apply deterministic final hybrid scoring after candidate SQL returns rows."""

    ranked = []
    for row in rows:
        raw = dict(row)
        components = _score_components(raw, requested_route)
        ranked.append(normalize_evidence_row(raw, score_components=components))

    ranked.sort(
        key=lambda item: (
            _finite_float((item.get("scoreComponents") or {}).get("hybridScore")),
            _route_preference(item, requested_route),
            _finite_float((item.get("scoreComponents") or {}).get("semanticScore")),
            _finite_float((item.get("scoreComponents") or {}).get("keywordScore")),
            str(item.get("id", "")),
        ),
        reverse=True,
    )
    if limit is None:
        return ranked
    try:
        bounded_limit = max(0, int(limit))
    except (TypeError, ValueError):
        bounded_limit = 0
    return ranked[:bounded_limit]


__all__ = ["build_hybrid_evidence_query", "normalize_evidence_row", "rank_evidence_rows"]

"""Deterministic, provenance-preserving BM25 evidence ranking."""

from __future__ import annotations

import re
from dataclasses import dataclass

from rank_bm25 import BM25Okapi


TOKEN_PATTERN = re.compile(r"[a-z0-9]+|[\u4e00-\u9fff]", re.IGNORECASE)


@dataclass(frozen=True)
class RankedEvidence:
    id: int | str
    body: str
    route_key: str
    source_tier: str
    is_synthetic: bool
    score_components: dict[str, float]
    raw: dict


@dataclass(frozen=True)
class RetrievalResult:
    items: list[RankedEvidence]
    mode: str
    reason: str = ""


def tokenize(text: object) -> list[str]:
    return TOKEN_PATTERN.findall(str(text or "").lower())


def _row_text(row: dict) -> str:
    keywords = " ".join(str(value) for value in (row.get("keywords") or []))
    return " ".join(
        [
            str(row.get("body") or row.get("original_content") or ""),
            str(row.get("translated_content") or ""),
            keywords,
            str(row.get("source") or row.get("source_name") or ""),
        ]
    )


def rank_evidence(query: str, rows: list[dict], *, route_key: str = "all", limit: int = 5) -> RetrievalResult:
    query_tokens = tokenize(query)
    if not query_tokens:
        return RetrievalResult(items=[], mode="unavailable", reason="empty_query")
    if not rows:
        return RetrievalResult(items=[], mode="bm25", reason="empty_corpus")

    corpus = [tokenize(_row_text(row)) for row in rows]
    scorer = BM25Okapi(corpus)
    scores = scorer.get_scores(query_tokens)
    query_terms = set(query_tokens)
    if not any(query_terms.intersection(document) for document in corpus):
        return RetrievalResult(items=[], mode="bm25", reason="no_lexical_match")
    ranked = []
    for row, raw_bm25 in zip(rows, scores, strict=True):
        item_route = str(row.get("route_key") or "all")
        route_boost = 0.15 if route_key != "all" and item_route == route_key else 0.0
        source_tier = str(row.get("source_tier") or "public_snapshot")
        is_synthetic = bool(row.get("is_synthetic"))
        lexical_match = bool(query_terms.intersection(corpus[len(ranked)]))
        ranked.append(
            RankedEvidence(
                id=row.get("id", ""),
                body=str(row.get("body") or row.get("original_content") or ""),
                route_key=item_route,
                source_tier=source_tier,
                is_synthetic=is_synthetic,
                score_components={
                    "bm25": round(float(raw_bm25), 6),
                    "route_boost": route_boost,
                    "lexical_match": float(lexical_match),
                },
                raw=dict(row),
            )
        )

    ranked.sort(
        key=lambda item: (
            item.score_components["lexical_match"],
            not item.is_synthetic,
            item.score_components["bm25"] + item.score_components["route_boost"],
            item.id,
        ),
        reverse=True,
    )
    return RetrievalResult(items=ranked[: max(1, min(int(limit), 20))], mode="bm25")

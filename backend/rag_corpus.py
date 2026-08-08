"""Read-only evidence corpus queries for RAG ranking."""

from __future__ import annotations


def build_evidence_corpus_query(*, route_key: str = "all") -> tuple[str, dict[str, str]]:
    where = ""
    params: dict[str, str] = {}
    if route_key and route_key != "all":
        where = "WHERE (r.route_key = %(route_key)s OR r.route_key = 'all' OR r.route_key IS NULL)"
        params["route_key"] = route_key

    sql = f"""
        SELECT
          e.id,
          e.original_content AS body,
          e.translated_content,
          e.keywords,
          e.evidence_kind,
          e.source_tier,
          e.is_synthetic,
          e.source_version,
          e.published_at,
          e.rating,
          e.review_count,
          e.url,
          e.metadata,
          s.name AS source_name,
          c.name AS company_name,
          r.display_name AS route_name,
          r.route_key
        FROM evidence_items e
        JOIN sources s ON s.id = e.source_id
        LEFT JOIN companies c ON c.id = e.company_id
        LEFT JOIN routes r ON r.id = e.route_id
        {where}
        ORDER BY e.id
    """
    return sql, params


def load_evidence_corpus(connection, *, route_key: str = "all") -> list[dict]:
    sql, params = build_evidence_corpus_query(route_key=route_key)
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]

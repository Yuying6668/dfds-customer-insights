#!/usr/bin/env python3
"""Import the fixed fictional interview-review corpus used by the demo."""

import argparse
import json
from datetime import datetime
from pathlib import Path

if __package__ in (None, ""):
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "synthetic_interview_reviews.json"
SOURCE_KEY = "synthetic-interview-review-corpus"
SOURCE_NAME = "Synthetic Interview Review Corpus"
SOURCE_VERSION = "2026-07-28"
SOURCE_TYPE = "synthetic_interview_review"
COMPANY_NAME = "DFDS"
SOURCE_TIER = "synthetic_demo"

REQUIRED_FIELDS = {
    "external_review_id",
    "route_key",
    "language",
    "rating",
    "published_at",
    "title",
    "review_text",
    "themes",
    "is_synthetic",
    "source_version",
}
EXPECTED_REVIEW_IDS = tuple(f"sir-{index:04d}" for index in range(1, 13))
ALLOWED_ROUTES = {
    "dover-calais",
    "newhaven-dieppe",
    "newcastle-ijmuiden",
    "jersey",
    "all",
}
ALLOWED_LANGUAGES = {"en", "da", "zh"}
FICTIONAL_MARKERS = {"en": "fictional", "da": "fiktiv", "zh": "虚构"}
ROUTE_DISPLAY_NAMES = {
    "all": "All signals",
    "dover-calais": "Dover-Calais",
    "newhaven-dieppe": "Newhaven-Dieppe",
    "newcastle-ijmuiden": "Newcastle-IJmuiden",
    "jersey": "Jersey / Channel Islands",
}


def _parse_published_at(value):
    if not isinstance(value, str) or not value:
        raise ValueError("published_at must be a non-empty ISO-8601 timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"published_at is not ISO-8601: {value!r}") from error
    if parsed.tzinfo is None:
        raise ValueError("published_at must include a timezone")
    return parsed


def _require_text(review, field):
    value = review.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty string")
    return value.strip()


def validate_review_record(review):
    if not isinstance(review, dict):
        raise ValueError("each review must be a JSON object")
    missing = REQUIRED_FIELDS.difference(review)
    if missing:
        raise ValueError(f"review is missing required fields: {', '.join(sorted(missing))}")

    external_review_id = _require_text(review, "external_review_id")
    if not external_review_id.startswith("sir-"):
        raise ValueError("external_review_id must use the sir- prefix")

    route_key = _require_text(review, "route_key")
    if route_key not in ALLOWED_ROUTES:
        raise ValueError(f"unsupported route_key: {route_key}")

    language = _require_text(review, "language")
    if language not in ALLOWED_LANGUAGES:
        raise ValueError(f"unsupported language: {language}")

    rating = review["rating"]
    if isinstance(rating, bool) or not isinstance(rating, (int, float)) or not 1 <= float(rating) <= 5:
        raise ValueError("rating must be a number from 1 through 5")

    _parse_published_at(review["published_at"])
    _require_text(review, "title")
    review_text = _require_text(review, "review_text")
    if FICTIONAL_MARKERS[language] not in review_text.lower():
        raise ValueError("review_text must retain its fictional interview-demo marker")

    themes = review["themes"]
    if not isinstance(themes, list) or not themes or any(not isinstance(theme, str) or not theme.strip() for theme in themes):
        raise ValueError("themes must be a non-empty list of strings")
    if review["is_synthetic"] is not True:
        raise ValueError("is_synthetic must be true")
    if review["source_version"] != SOURCE_VERSION:
        raise ValueError(f"source_version must be {SOURCE_VERSION}")


def validate_review_records(records):
    if not isinstance(records, list):
        raise ValueError("synthetic interview review data must be a JSON array")
    if len(records) != len(EXPECTED_REVIEW_IDS):
        raise ValueError("the synthetic interview review corpus must contain exactly 12 records")

    for review in records:
        validate_review_record(review)

    ids = tuple(sorted(review["external_review_id"] for review in records))
    if ids != EXPECTED_REVIEW_IDS:
        raise ValueError("the corpus must contain sir-0001 through sir-0012 exactly once")

    language_counts = {language: sum(review["language"] == language for review in records) for language in ALLOWED_LANGUAGES}
    if language_counts != {"en": 4, "da": 4, "zh": 4}:
        raise ValueError("the corpus must contain four English, four Danish, and four Chinese records")
    if {review["route_key"] for review in records} != ALLOWED_ROUTES:
        raise ValueError("the corpus must cover every fixed route key")


def load_review_records(path=DATA_PATH):
    records = json.loads(Path(path).read_text(encoding="utf-8"))
    validate_review_records(records)
    return [dict(review, themes=list(review["themes"])) for review in sorted(records, key=lambda review: review["external_review_id"])]


def _raw_review_metadata(review):
    return {
        "language": review["language"],
        "route_key": review["route_key"],
        "source_name": SOURCE_NAME,
        "source_tier": SOURCE_TIER,
        "source_version": review["source_version"],
        "synthetic_source": True,
        "themes": list(review["themes"]),
    }


def make_evidence_record(review, raw_review_id):
    validate_review_record(review)
    if not isinstance(raw_review_id, int) or raw_review_id < 1:
        raise ValueError("raw_review_id must be a positive integer")

    title = review["title"].strip()
    original_content = (
        f"{SOURCE_NAME} | {review['external_review_id']} | {title}: "
        f"{review['review_text'].strip()}"
    )
    metadata = {
        "evidence_type": "synthetic_interview_review",
        "language": review["language"],
        "raw_review_external_id": review["external_review_id"],
        "raw_review_id": raw_review_id,
        "source_name": SOURCE_NAME,
        "source_tier": SOURCE_TIER,
        "source_version": review["source_version"],
        "synthetic_source": True,
        "themes": list(review["themes"]),
    }
    keywords = list(dict.fromkeys([*review["themes"], "synthetic-demo", "interview-review"]))
    return {
        "source_key": SOURCE_KEY,
        "source_name": SOURCE_NAME,
        "source_type": SOURCE_TYPE,
        "company_name": COMPANY_NAME,
        "route_key": review["route_key"],
        "raw_review_id": raw_review_id,
        "evidence_kind": "synthetic_interview_review",
        "original_content": original_content,
        "translated_content": "",
        "rating": float(review["rating"]),
        "review_count": None,
        "published_at": review["published_at"][:10],
        "url": "",
        "keywords": keywords,
        "metadata": metadata,
        "source_tier": SOURCE_TIER,
        "is_synthetic": True,
        "source_version": review["source_version"],
        "semantic_embedding": None,
    }


def raw_review_upsert_sql():
    return """
        INSERT INTO raw_reviews (
          source_id, company_id, external_review_id, title, review_text, rating,
          language, published_at, metadata, raw_json, is_synthetic, source_version
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, TRUE, %s)
        ON CONFLICT (source_id, external_review_id) DO UPDATE
        SET company_id = EXCLUDED.company_id,
            title = EXCLUDED.title,
            review_text = EXCLUDED.review_text,
            rating = EXCLUDED.rating,
            language = EXCLUDED.language,
            published_at = EXCLUDED.published_at,
            metadata = EXCLUDED.metadata,
            raw_json = EXCLUDED.raw_json,
            is_synthetic = TRUE,
            source_version = EXCLUDED.source_version
        RETURNING id
    """


def evidence_upsert_sql():
    return """
        INSERT INTO evidence_items (
          source_id, company_id, route_id, raw_review_id, evidence_kind,
          original_content, translated_content, rating, review_count, published_at,
          url, metadata, keywords, source_tier, is_synthetic, source_version
        )
        VALUES (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
          %s::jsonb, %s::text[], 'synthetic_demo', TRUE, %s
        )
        ON CONFLICT (source_id, original_content) DO UPDATE
        SET company_id = EXCLUDED.company_id,
            route_id = EXCLUDED.route_id,
            raw_review_id = EXCLUDED.raw_review_id,
            evidence_kind = EXCLUDED.evidence_kind,
            translated_content = EXCLUDED.translated_content,
            rating = EXCLUDED.rating,
            review_count = EXCLUDED.review_count,
            published_at = EXCLUDED.published_at,
            url = EXCLUDED.url,
            metadata = EXCLUDED.metadata,
            keywords = EXCLUDED.keywords,
            source_tier = EXCLUDED.source_tier,
            is_synthetic = TRUE,
            source_version = EXCLUDED.source_version
    """


def _prepared_records(records):
    prepared = [dict(review, themes=list(review["themes"])) for review in records]
    if not prepared:
        raise ValueError("at least one synthetic interview review is required for import")
    for review in prepared:
        validate_review_record(review)
    external_ids = [review["external_review_id"] for review in prepared]
    if len(external_ids) != len(set(external_ids)):
        raise ValueError("external_review_id values must be unique within an import")
    if len(prepared) == len(EXPECTED_REVIEW_IDS):
        validate_review_records(prepared)
    return sorted(prepared, key=lambda review: review["external_review_id"])


def _raw_review_exists(cur, source_id, external_review_id):
    cur.execute(
        "SELECT 1 FROM raw_reviews WHERE source_id = %s AND external_review_id = %s",
        (source_id, external_review_id),
    )
    return cur.fetchone() is not None


def _evidence_exists(cur, source_id, original_content):
    cur.execute(
        "SELECT 1 FROM evidence_items WHERE source_id = %s AND original_content = %s",
        (source_id, original_content),
    )
    return cur.fetchone() is not None


def import_records(conn, records):
    records = _prepared_records(records)
    return _import_prepared_records(conn, records, commit=True)


def _import_prepared_records(conn, records, commit):
    summary = {
        "records": len(records),
        "raw_inserted": 0,
        "raw_updated": 0,
        "evidence_inserted": 0,
        "evidence_updated": 0,
    }
    with conn.cursor() as cur:
        source_id = server.insert_source(
            cur,
            SOURCE_KEY,
            SOURCE_NAME,
            SOURCE_TYPE,
            "Synthetic demo",
            notes=(
                "Fictional interview-demo records only; not real DFDS customer, booking, CRM, or operational data."
            ),
            last_checked_at=SOURCE_VERSION,
        )
        company_id = server.insert_company(cur, COMPANY_NAME, is_baseline=True)
        route_ids = {}
        for review in records:
            route_key = review["route_key"]
            if route_key not in route_ids:
                route_ids[route_key] = server.insert_route(
                    cur,
                    route_key,
                    ROUTE_DISPLAY_NAMES[route_key],
                    "Synthetic interview-demo route context; not an operational record.",
                )

            raw_exists = _raw_review_exists(cur, source_id, review["external_review_id"])
            cur.execute(
                raw_review_upsert_sql(),
                (
                    source_id,
                    company_id,
                    review["external_review_id"],
                    review["title"],
                    review["review_text"],
                    float(review["rating"]),
                    review["language"],
                    review["published_at"],
                    json.dumps(_raw_review_metadata(review), ensure_ascii=False, sort_keys=True),
                    json.dumps(review, ensure_ascii=False, sort_keys=True),
                    review["source_version"],
                ),
            )
            raw_review_row = cur.fetchone()
            if not raw_review_row:
                raise RuntimeError("raw review upsert did not return an id")
            raw_review_id = raw_review_row["id"]
            if raw_exists:
                summary["raw_updated"] += 1
            else:
                summary["raw_inserted"] += 1

            evidence = make_evidence_record(review, raw_review_id)
            evidence_exists = _evidence_exists(cur, source_id, evidence["original_content"])
            cur.execute(
                evidence_upsert_sql(),
                (
                    source_id,
                    company_id,
                    route_ids[route_key],
                    evidence["raw_review_id"],
                    evidence["evidence_kind"],
                    evidence["original_content"],
                    evidence["translated_content"],
                    evidence["rating"],
                    evidence["review_count"],
                    evidence["published_at"],
                    evidence["url"],
                    json.dumps(evidence["metadata"], ensure_ascii=False, sort_keys=True),
                    evidence["keywords"],
                    evidence["source_version"],
                ),
            )
            if evidence_exists:
                summary["evidence_updated"] += 1
            else:
                summary["evidence_inserted"] += 1
    if commit:
        conn.commit()
    return summary


def replace_records(conn, records):
    records = _prepared_records(records)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM evidence_items
                WHERE source_id = (SELECT id FROM sources WHERE source_key = %s)
                """,
                (SOURCE_KEY,),
            )
            cur.execute(
                """
                DELETE FROM raw_reviews
                WHERE source_id = (SELECT id FROM sources WHERE source_key = %s)
                """,
                (SOURCE_KEY,),
            )
        summary = _import_prepared_records(conn, records, commit=False)
        conn.commit()
        return summary
    except Exception:
        conn.rollback()
        raise


def summarize_records(records):
    return {
        "records": len(records),
        "source_key": SOURCE_KEY,
        "source_name": SOURCE_NAME,
        "source_version": SOURCE_VERSION,
        "first_normalized_record": records[0],
    }


def run_import(args):
    records = load_review_records()
    summary = summarize_records(records)
    if args.dry_run:
        return summary

    server.load_local_env()
    conn = server.connect_db(register=False)
    if conn is None:
        raise RuntimeError("DATABASE_URL or psycopg is unavailable; cannot import synthetic interview reviews")
    try:
        server.execute_schema(conn)
        result = replace_records(conn, records) if args.replace else import_records(conn, records)
        summary.update(result)
    finally:
        conn.close()
    return summary


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Import the fixed synthetic interview-review demo corpus.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print the corpus without opening a database connection.")
    parser.add_argument("--replace", action="store_true", help="Replace only this corpus's raw reviews and evidence rows.")
    return parser.parse_args(argv)


def main(argv=None):
    print(json.dumps(run_import(parse_args(argv)), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

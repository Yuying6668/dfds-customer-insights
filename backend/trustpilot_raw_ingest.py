#!/usr/bin/env python3
import argparse
import json
import os
import re
import ssl
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import server

try:
    import certifi
except ImportError:
    certifi = None


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "db" / "schema.sql"
RAW_DIR = ROOT / "work" / "trustpilot_raw"
API_BASE_URL = "https://api.trustpilot.com/v1"
DEFAULT_DOMAIN = "dfds.com"
DEFAULT_COMPANY = "DFDS"
DEFAULT_PAGE_SIZE = 100
HTTPS_CONTEXT = ssl.create_default_context(cafile=certifi.where()) if certifi else ssl.create_default_context()


class TrustpilotConfigError(RuntimeError):
    pass


class TrustpilotBlockedError(RuntimeError):
    pass


def clean_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def date_part(value):
    match = re.match(r"(\d{4}-\d{2}-\d{2})", str(value or ""))
    return match.group(1) if match else None


def endpoint(path):
    return f"{API_BASE_URL}{path}"


def api_fetch(path, params=None, api_key=None, timeout=35):
    api_key = api_key or os.environ.get("TRUSTPILOT_API_KEY")
    if not api_key:
        raise TrustpilotConfigError("TRUSTPILOT_API_KEY is not set")

    url = endpoint(path)
    query = dict(params or {})
    query["apikey"] = api_key
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "DFDS-Customer-Intelligence/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout, context=HTTPS_CONTEXT) as response:
        return json.loads(response.read().decode("utf-8"))


def resolve_business_unit_id(domain=DEFAULT_DOMAIN, fetch=api_fetch):
    configured = os.environ.get("TRUSTPILOT_BUSINESS_UNIT_ID")
    if configured:
        return configured
    data = fetch("/business-units/find", {"name": domain})
    business_unit_id = data.get("id") or data.get("businessUnitId")
    if not business_unit_id:
        raise TrustpilotConfigError(f"Could not resolve Trustpilot business unit id for {domain}")
    return business_unit_id


def iter_reviews(business_unit_id, fetch=api_fetch, page_size=None, max_pages=None, max_reviews=None):
    page_token = None
    yielded = 0
    page_index = 0
    while True:
        if max_pages is not None and page_index >= max_pages:
            return
        params = {}
        if page_token:
            params["pageToken"] = page_token
        elif page_size:
            params["perPage"] = page_size
        data = fetch(f"/business-units/{business_unit_id}/all-reviews", params)
        page_index += 1
        reviews = data.get("reviews") or []
        for review in reviews:
            if max_reviews is not None and yielded >= max_reviews:
                return
            yielded += 1
            yield normalize_review(review, business_unit_id=business_unit_id, page_index=page_index)
        page_token = data.get("nextPageToken")
        if not page_token:
            return


def normalize_review(review, business_unit_id, page_index=1, company_name=DEFAULT_COMPANY):
    consumer = review.get("consumer") or {}
    company_reply = review.get("companyReply") or {}
    review_id = str(review.get("id") or review.get("reviewId") or "").strip()
    if not review_id:
        raise ValueError("Trustpilot review has no id")

    title = clean_text(review.get("title"))
    text = clean_text(review.get("text") or review.get("reviewText"))
    rating = review.get("stars") or review.get("rating")
    metadata = {
        "import_batch": "trustpilot_raw_api",
        "business_unit_id": business_unit_id,
        "page_index": page_index,
        "consumer_id": consumer.get("id"),
        "consumer_country": consumer.get("country"),
        "company_reply_updated_at": company_reply.get("updatedAt"),
    }
    return {
        "source_key": "trustpilot",
        "source_name": "Trustpilot",
        "source_type": "review",
        "company_name": company_name,
        "external_review_id": review_id,
        "source_review_url": review.get("reviewUrl") or review.get("url") or "",
        "title": title,
        "review_text": text,
        "rating": float(rating) if rating is not None else None,
        "language": review.get("language"),
        "consumer_display_name": clean_text(consumer.get("displayName")),
        "consumer_location": clean_text(consumer.get("displayLocation") or consumer.get("country")),
        "is_verified": review.get("isVerified"),
        "published_at": review.get("createdAt") or review.get("publishedAt"),
        "updated_at": review.get("updatedAt"),
        "experienced_at": review.get("experiencedAt"),
        "company_reply": clean_text(company_reply.get("text")),
        "company_reply_at": company_reply.get("createdAt"),
        "metadata": metadata,
        "raw_json": review,
    }


def review_to_evidence(review):
    original = clean_text(f"{review.get('title')}: {review.get('review_text')}".strip(": "))
    metadata = {
        "import_batch": "trustpilot_raw_api",
        "evidence_type": "trustpilot_raw_review",
        "raw_review_id": review["external_review_id"],
        "language": review.get("language"),
        "is_verified": review.get("is_verified"),
        "consumer_location": review.get("consumer_location"),
    }
    keywords = server.derive_keywords(
        "trustpilot_raw_review",
        original,
        "",
        metadata,
        route="all",
        source="trustpilot",
        extra=["raw-review", "trustpilot"],
        limit=24,
    )
    return {
        "source_key": "trustpilot",
        "source_name": "Trustpilot",
        "source_type": "review",
        "company_name": review.get("company_name") or DEFAULT_COMPANY,
        "route_key": "all",
        "evidence_kind": "trustpilot_raw_review",
        "original_content": original,
        "translated_content": "",
        "rating": review.get("rating"),
        "review_count": None,
        "published_at": date_part(review.get("published_at")),
        "url": review.get("source_review_url") or "",
        "keywords": keywords,
        "metadata": metadata,
    }


def raw_review_upsert_sql():
    return """
        INSERT INTO raw_reviews (
          source_id, company_id, external_review_id, source_review_url, title, review_text,
          rating, language, consumer_display_name, consumer_location, is_verified,
          published_at, updated_at, experienced_at, company_reply, company_reply_at,
          metadata, raw_json, scraped_at
        )
        VALUES (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
          %s::jsonb, %s::jsonb, NOW()
        )
        ON CONFLICT (source_id, external_review_id) DO UPDATE
        SET company_id = EXCLUDED.company_id,
            source_review_url = EXCLUDED.source_review_url,
            title = EXCLUDED.title,
            review_text = EXCLUDED.review_text,
            rating = EXCLUDED.rating,
            language = EXCLUDED.language,
            consumer_display_name = EXCLUDED.consumer_display_name,
            consumer_location = EXCLUDED.consumer_location,
            is_verified = EXCLUDED.is_verified,
            published_at = EXCLUDED.published_at,
            updated_at = EXCLUDED.updated_at,
            experienced_at = EXCLUDED.experienced_at,
            company_reply = EXCLUDED.company_reply,
            company_reply_at = EXCLUDED.company_reply_at,
            metadata = EXCLUDED.metadata,
            raw_json = EXCLUDED.raw_json,
            scraped_at = NOW()
    """


def evidence_upsert_sql():
    return """
        INSERT INTO evidence_items (
          source_id, company_id, route_id, evidence_kind, original_content, translated_content,
          rating, review_count, published_at, url, metadata, keywords, embedding
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::text[], %s)
        ON CONFLICT (source_id, original_content) DO UPDATE
        SET company_id = EXCLUDED.company_id,
            route_id = EXCLUDED.route_id,
            evidence_kind = EXCLUDED.evidence_kind,
            translated_content = EXCLUDED.translated_content,
            rating = EXCLUDED.rating,
            published_at = EXCLUDED.published_at,
            url = EXCLUDED.url,
            metadata = EXCLUDED.metadata,
            keywords = EXCLUDED.keywords,
            embedding = EXCLUDED.embedding
    """


def upsert_reviews(conn, reviews, sync_evidence=True):
    summary = {"reviews": len(reviews), "raw_inserted": 0, "raw_updated": 0, "evidence_inserted": 0, "evidence_updated": 0}
    with conn.cursor() as cur:
        source_id = server.insert_source(
            cur,
            "trustpilot",
            "Trustpilot",
            "review",
            "Collected",
            source_url="https://www.trustpilot.com/review/dfds.com",
            notes="Raw Trustpilot reviews imported through Trustpilot API.",
            last_checked_at=datetime.now(timezone.utc).date().isoformat(),
        )
        company_id = server.insert_company(cur, DEFAULT_COMPANY, is_baseline=True)
        route_id = server.insert_route(cur, "all", "All signals", "Cross-route passenger ferry signals.")
        for review in reviews:
            exists = cur.execute(
                "SELECT 1 FROM raw_reviews WHERE source_id = %s AND external_review_id = %s",
                (source_id, review["external_review_id"]),
            ).fetchone()
            cur.execute(
                raw_review_upsert_sql(),
                (
                    source_id,
                    company_id,
                    review["external_review_id"],
                    review.get("source_review_url"),
                    review.get("title"),
                    review.get("review_text") or "",
                    review.get("rating"),
                    review.get("language"),
                    review.get("consumer_display_name"),
                    review.get("consumer_location"),
                    review.get("is_verified"),
                    review.get("published_at"),
                    review.get("updated_at"),
                    review.get("experienced_at"),
                    review.get("company_reply"),
                    review.get("company_reply_at"),
                    json.dumps(review.get("metadata", {}), ensure_ascii=False),
                    json.dumps(review.get("raw_json", {}), ensure_ascii=False),
                ),
            )
            if exists:
                summary["raw_updated"] += 1
            else:
                summary["raw_inserted"] += 1

            if not sync_evidence:
                continue
            evidence = review_to_evidence(review)
            evidence_exists = cur.execute(
                "SELECT 1 FROM evidence_items WHERE source_id = %s AND original_content = %s",
                (source_id, evidence["original_content"]),
            ).fetchone()
            vector_text = " ".join(
                [
                    evidence["evidence_kind"],
                    evidence["original_content"],
                    json.dumps(evidence["metadata"], ensure_ascii=False),
                    " ".join(evidence["keywords"]),
                ]
            )
            cur.execute(
                evidence_upsert_sql(),
                (
                    source_id,
                    company_id,
                    route_id,
                    evidence["evidence_kind"],
                    evidence["original_content"],
                    evidence["translated_content"],
                    evidence["rating"],
                    evidence["review_count"],
                    evidence["published_at"],
                    evidence["url"],
                    json.dumps(evidence["metadata"], ensure_ascii=False),
                    evidence["keywords"],
                    server.vectorize_text(vector_text),
                ),
            )
            if evidence_exists:
                summary["evidence_updated"] += 1
            else:
                summary["evidence_inserted"] += 1
    conn.commit()
    return summary


def save_checkpoint(reviews):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / f"trustpilot-dfds-raw-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.json"
    path.write_text(json.dumps(reviews, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def run(args):
    server.load_local_env()
    business_unit_id = resolve_business_unit_id(args.domain)
    reviews = []
    for review in iter_reviews(
        business_unit_id,
        page_size=args.page_size,
        max_pages=args.max_pages,
        max_reviews=args.max_reviews,
    ):
        reviews.append(review)
        if args.sleep and len(reviews) % args.page_size == 0:
            time.sleep(args.sleep)

    checkpoint = save_checkpoint(reviews)
    summary = {
        "business_unit_id": business_unit_id,
        "fetched_reviews": len(reviews),
        "checkpoint": str(checkpoint),
        "dry_run": args.dry_run,
    }
    if args.dry_run:
        return summary

    conn = server.connect_db(register=False)
    if conn is None:
        raise RuntimeError("DATABASE_URL or psycopg is unavailable")
    try:
        server.execute_schema(conn)
        if server.register_vector is not None:
            server.register_vector(conn)
        summary.update(upsert_reviews(conn, reviews, sync_evidence=not args.no_evidence))
        server.analyze_database(conn)
    finally:
        conn.close()
    return summary


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Import DFDS Trustpilot raw reviews into PostgreSQL.")
    parser.add_argument("--domain", default=DEFAULT_DOMAIN)
    parser.add_argument("--page-size", type=int, default=DEFAULT_PAGE_SIZE)
    parser.add_argument("--max-pages", type=int)
    parser.add_argument("--max-reviews", type=int)
    parser.add_argument("--sleep", type=float, default=0.3)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-evidence", action="store_true", help="Only populate raw_reviews; skip evidence_items sync.")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    try:
        summary = run(args)
    except TrustpilotConfigError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2))
        raise SystemExit(2)
    print(json.dumps({"ok": True, **summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

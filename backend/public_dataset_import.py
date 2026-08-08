#!/usr/bin/env python3
import argparse
import html
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import server


ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "data" / "seed.json"
RAW_DIR = ROOT / "work" / "public_keyword_raw"
FIRECRAWL_DIR = ROOT / ".firecrawl"
CACHED_KEYWORD_PATH = RAW_DIR / "normalized-public-keyword-records.json"

SOURCE_NAMES = {
    "trustpilot": ("Trustpilot", "review"),
    "google-play": ("Google Play Reviews", "app_store"),
    "apple-app-store": ("Apple App Store Reviews", "app_store"),
    "google-reviews": ("Google Reviews", "location_review"),
    "reddit": ("Reddit", "discussion"),
    "company-news": ("Company News", "news"),
    "gdelt-news": ("GDELT News Search", "news"),
    "mia-smalltalk-playbook": ("Mia Small Talk Playbook", "conversation_playbook"),
    "public-web": ("Public Web", "public_source"),
    "survey-csv": ("Future Survey CSV", "future_upload"),
}


def load_seed(path=SEED_PATH):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def clean_text(value):
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def compact_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def parse_review_count_text(value):
    text = str(value or "")
    patterns = [
        r"from\s+(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?\s+(?:google\s+)?reviews?",
        r"(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?\s+(?:google\s+)?reviews?",
        r"(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?\s+ratings?",
        r"what\s+(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?\s+people\s+have\s+written",
        r"(\d[\d,]*(?:\.\d+)?)\s*([kKmM])?\s+people\s+have\s+written",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue
        count = float(match.group(1).replace(",", ""))
        suffix = (match.group(2) or "").lower()
        if suffix == "k":
            count *= 1000
        elif suffix == "m":
            count *= 1000000
        return int(count)
    return None


def parse_competitor_review_count(value):
    return server.parse_review_count(value)


def source_details(source_key):
    return SOURCE_NAMES.get(source_key, (source_key.replace("-", " ").title(), "public_source"))


def source_details_for_url(url, title=""):
    label = f"{url} {title}".lower()
    if "itunes.apple.com" in label or "apps.apple.com" in label:
        return "apple-app-store", "Apple App Store Reviews", "app_store"
    if "play.google.com" in label:
        return "google-play", "Google Play Reviews", "app_store"
    if "reddit.com" in label:
        return "reddit", "Reddit", "discussion"
    if "trustpilot.com" in label:
        return "trustpilot", "Trustpilot", "review"
    if "wanderlog.com" in label:
        return "google-reviews", "Google Reviews", "location_review"
    if "bbc." in label or "guardian" in label:
        return "company-news", "Company News", "news"
    return "public-web", "Public Web", "public_source"


def classify_route(text):
    label = str(text or "").lower()
    if "dover" in label or "calais" in label:
        return "dover-calais"
    if "newhaven" in label or "dieppe" in label or "transmanche" in label:
        return "newhaven-dieppe"
    if "newcastle" in label or "ijmuiden" in label:
        return "newcastle-ijmuiden"
    if "jersey" in label or "channel islands" in label:
        return "jersey"
    return "all"


def route_display_name(key):
    return {
        "all": "All signals",
        "dover-calais": "Dover-Calais",
        "newhaven-dieppe": "Newhaven-Dieppe",
        "newcastle-ijmuiden": "Newcastle-IJmuiden",
        "jersey": "Jersey / Channel Islands",
        "smalltalk": "Smalltalk",
    }.get(key, str(key or "all").replace("-", " ").title())


def source_catalog_by_title(seed):
    return {item.get("title", ""): item for item in seed.get("sources", [])}


def source_url_for(seed, source_key, company_name=""):
    company_label = company_name.lower()
    for item in seed.get("sources", []):
        title = item.get("title", "").lower()
        url = item.get("url", "")
        key, _, _ = source_details_for_url(url, title)
        if company_label and company_label in title:
            return url
        if not company_label and key == source_key:
            return url
    return ""


def company_from_search(seed, *parts):
    label = " ".join(str(part or "") for part in parts).lower()
    for competitor in seed.get("competitors", []):
        company = competitor.get("company", "")
        if company and company.lower() in label:
            return company
    file_aliases = {
        "poferries": "P&O Ferries",
        "condor": "Condor Ferries",
        "scandlines": "Scandlines",
        "color-line": "Color Line",
        "fjord": "Fjord Line",
        "tt-line": "TT-Line",
        "tallink": "Tallink Silja",
        "viking": "Viking Line",
    }
    for alias, company in file_aliases.items():
        if alias in label:
            return company
    return "DFDS"


def parse_trust_score(*parts):
    text = " ".join(str(part or "") for part in parts)
    patterns = [
        r"TrustScore\s+(\d+(?:\.\d+)?)\s+out\s+of\s+5",
        r"(\d+(?:\.\d+)?)\s+(?:Excellent|Great|Average|Poor|Bad)\s+TrustScore",
        r"Rated\s+(\d+(?:\.\d+)?)\s+out\s+of\s+5",
        r"Score\s+(\d+(?:\.\d+)?)\s*/\s*5",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return float(match.group(1))
    return None


def make_record(
    *,
    source_key,
    evidence_kind,
    original_content,
    translated_content="",
    source_name="",
    source_type="",
    company_name="DFDS",
    route_key="all",
    rating=None,
    review_count=None,
    published_at=None,
    url="",
    metadata=None,
    extra_keywords=None,
):
    source_name = source_name or source_details(source_key)[0]
    source_type = source_type or source_details(source_key)[1]
    metadata = dict(metadata or {})
    metadata.setdefault("evidence_type", evidence_kind)
    metadata.setdefault("company", company_name)
    metadata.setdefault("route", route_key)
    metadata.setdefault("source_name", source_name)
    metadata.setdefault("source_url", url)

    keyword_extra = list(extra_keywords or [])
    keyword_extra.extend([metadata.get("evidence_type", ""), company_name])
    keywords = server.derive_keywords(
        evidence_kind,
        original_content,
        translated_content,
        metadata,
        route=route_key,
        source=source_key,
        extra=keyword_extra,
        limit=24,
    )
    for keyword in reversed(extra_keywords or []):
        normalized = server.normalize_keyword(keyword)
        if normalized and normalized not in keywords:
            keywords.insert(0, normalized)
    keywords = keywords[:24]

    return {
        "source_key": source_key,
        "source_name": source_name,
        "source_type": source_type,
        "company_name": company_name,
        "route_key": route_key or "all",
        "evidence_kind": evidence_kind,
        "original_content": compact_text(original_content),
        "translated_content": compact_text(translated_content),
        "rating": rating,
        "review_count": review_count,
        "published_at": published_at,
        "url": url,
        "keywords": keywords,
        "metadata": metadata,
    }


def build_source_coverage_records(seed):
    collected_at = seed.get("collectedAt")
    records = []
    for coverage in seed.get("sourceCoverage", []):
        source_label = coverage.get("source", "")
        source_key = server.canonical_source_key(source_label)
        if source_key == "survey-csv":
            continue
        source_name, source_type = source_details(source_key)
        records.append(
            make_record(
                source_key=source_key,
                source_name=source_name,
                source_type=source_type,
                evidence_kind="source_coverage_snapshot",
                original_content=(
                    f"Source coverage: {source_label}. Status: {coverage.get('status')}. "
                    f"Records: {coverage.get('records')}. Insight: {coverage.get('insight')}"
                ),
                translated_content=coverage.get("insight", ""),
                review_count=parse_review_count_text(coverage.get("records")),
                published_at=collected_at,
                url=source_url_for(seed, source_key),
                metadata={
                    "evidence_type": "source_coverage_snapshot",
                    "import_batch": "seed_public_dataset",
                    "status": coverage.get("status"),
                    "record_text": coverage.get("records"),
                    "source_label": source_label,
                    "collected_at": collected_at,
                    "logo_url": coverage.get("logo", ""),
                },
                extra_keywords=["source-coverage"],
            )
        )
    return records


def build_app_store_records(seed):
    collected_at = seed.get("collectedAt")
    records = []
    for app in seed.get("appStores", []):
        source_key = server.canonical_source_key(app.get("platform"))
        source_name, source_type = source_details(source_key)
        records.append(
            make_record(
                source_key=source_key,
                source_name=source_name,
                source_type=source_type,
                evidence_kind="app_store_rating",
                original_content=(
                    f"{app.get('app')} on {app.get('platform')}: {app.get('rating')} "
                    f"from {app.get('reviewCount')}. {app.get('summary')}"
                ),
                translated_content=app.get("summary", ""),
                rating=server.parse_rating(app.get("rating")),
                review_count=server.parse_review_count(app.get("reviewCount")),
                published_at=collected_at,
                url=app.get("url", ""),
                metadata={
                    "evidence_type": "app_store_rating",
                    "import_batch": "seed_public_dataset",
                    "platform": app.get("platform"),
                    "app": app.get("app"),
                    "package": app.get("package"),
                    "status": app.get("status"),
                    "normalized": app.get("normalized"),
                },
            )
        )
    return records


def build_google_location_records(seed):
    collected_at = seed.get("collectedAt")
    records = []
    for location in seed.get("googleReviewLocations", []):
        records.append(
            make_record(
                source_key="google-reviews",
                evidence_kind="google_location_review_seed",
                original_content=f"{location.get('name')}: {location.get('signal')}",
                translated_content=location.get("signal", ""),
                route_key=location.get("route", "all"),
                rating=server.parse_rating(location.get("rating")),
                review_count=server.parse_review_count(location.get("reviews")),
                published_at=collected_at,
                url=location.get("url", ""),
                metadata={
                    "evidence_type": "google_location_review_seed",
                    "import_batch": "seed_public_dataset",
                    "location": location.get("name"),
                    "route": location.get("route"),
                    "source_detail": location.get("source"),
                    "rating_text": location.get("rating"),
                    "review_count_text": location.get("reviews"),
                },
            )
        )
    return records


def build_app_review_records(seed):
    records = []
    for review in seed.get("appReviewEvidence", []):
        text_for_route = json.dumps(review, ensure_ascii=False)
        source_key = server.canonical_source_key(review.get("platform"))
        records.append(
            make_record(
                source_key=source_key,
                evidence_kind="app_review",
                original_content=review.get("evidence", ""),
                translated_content=review.get("businessMeaning", ""),
                route_key=classify_route(text_for_route),
                rating=server.parse_rating(review.get("rating")),
                published_at=review.get("date"),
                url=source_url_for(seed, source_key),
                metadata={
                    "evidence_type": "app_review",
                    "import_batch": "seed_public_dataset",
                    "title": review.get("title"),
                    "theme": review.get("theme"),
                    "platform": review.get("platform"),
                },
            )
        )
    return records


def build_signal_records(seed):
    collected_at = seed.get("collectedAt")
    records = []
    for signal in seed.get("signals", []):
        source_key = server.canonical_source_key(signal.get("source"))
        source_name, source_type = source_details(source_key)
        records.append(
            make_record(
                source_key=source_key,
                source_name=source_name,
                source_type=source_type,
                evidence_kind="public_feedback_signal",
                original_content=signal.get("evidence", ""),
                translated_content=signal.get("businessMeaning", ""),
                route_key=signal.get("route", "all"),
                rating=server.parse_rating(signal.get("evidence")),
                review_count=parse_review_count_text(signal.get("evidence")),
                published_at=collected_at,
                url=source_url_for(seed, source_key),
                metadata={
                    "evidence_type": "public_feedback_signal",
                    "import_batch": "seed_public_dataset",
                    "theme": signal.get("theme"),
                    "sentiment": signal.get("sentiment"),
                    "journey_stage": signal.get("journeyStage"),
                    "source_label": signal.get("source"),
                },
            )
        )
    return records


def build_source_catalog_records(seed):
    records = []
    for source in seed.get("sources", []):
        url = source.get("url", "")
        title = source.get("title", "")
        source_key, source_name, source_type = source_details_for_url(url, title)
        records.append(
            make_record(
                source_key=source_key,
                source_name=source_name,
                source_type=source_type,
                evidence_kind="source_catalog_entry",
                original_content=f"Source catalog: {title}. URL: {url}. Note: {source.get('note')}",
                translated_content=source.get("note", ""),
                route_key=classify_route(f"{title} {source.get('note')}"),
                url=url,
                metadata={
                    "evidence_type": "source_catalog_entry",
                    "import_batch": "seed_public_dataset",
                    "source_title": title,
                    "source_note": source.get("note"),
                    "collection_method": "seed_source_catalog",
                },
                extra_keywords=["source-catalog"],
            )
        )
    return records


def build_competitor_records(seed):
    collected_at = seed.get("collectedAt")
    records = []
    for competitor in seed.get("competitors", []):
        company = competitor.get("company", "DFDS")
        url = source_url_for(seed, "trustpilot", company)
        records.append(
            make_record(
                source_key="trustpilot",
                evidence_kind="competitor_trustpilot_snapshot",
                company_name=company,
                original_content=(
                    f"Competitor Trustpilot benchmark: {company}. "
                    f"Category: {competitor.get('category')}. "
                    f"Score {competitor.get('score')}/5 from {competitor.get('reviews')} reviews. "
                    f"User view: {competitor.get('userView')} Routes: {competitor.get('routes')} "
                    f"Overlap with DFDS: {competitor.get('overlap')}"
                ),
                translated_content=competitor.get("learning", ""),
                rating=server.parse_rating(competitor.get("score")),
                review_count=parse_competitor_review_count(competitor.get("reviews")),
                published_at=collected_at,
                url=url,
                metadata={
                    "evidence_type": "competitor_benchmark_snapshot",
                    "import_batch": "seed_public_dataset",
                    "category": competitor.get("category"),
                    "normalized": competitor.get("normalized"),
                    "reviews_text": competitor.get("reviews"),
                    "routes": competitor.get("routes"),
                    "overlap": competitor.get("overlap"),
                    "learning": competitor.get("learning"),
                    "collection_method": "seed_competitor_snapshot",
                },
                extra_keywords=["competitor-benchmark", "trustpilot-benchmark"],
            )
        )
    return records


def build_seed_public_records(seed=None):
    seed = seed or load_seed()
    records = []
    records.extend(build_source_coverage_records(seed))
    records.extend(build_app_store_records(seed))
    records.extend(build_google_location_records(seed))
    records.extend(build_app_review_records(seed))
    records.extend(build_signal_records(seed))
    records.extend(build_source_catalog_records(seed))
    records.extend(build_competitor_records(seed))
    return dedupe_records(records)


def load_cached_keyword_records(path=CACHED_KEYWORD_PATH):
    path = Path(path)
    if not path.exists():
        return []
    records = json.loads(path.read_text(encoding="utf-8"))
    normalized = []
    for record in records:
        item = dict(record)
        item.setdefault("company_name", "DFDS")
        item.setdefault("source_name", source_details(item.get("source_key", ""))[0])
        item.setdefault("source_type", source_details(item.get("source_key", ""))[1])
        item.setdefault("route_key", "all")
        item.setdefault("keywords", [])
        item.setdefault("metadata", {})
        item["metadata"] = dict(item["metadata"])
        item["metadata"]["import_batch"] = "cached_public_keyword"
        item["metadata"].setdefault("evidence_type", item.get("evidence_kind", "public_keyword_record"))
        item["metadata"].setdefault("company", item["company_name"])
        item["metadata"].setdefault("route", item["route_key"])
        item["metadata"].setdefault("source_name", item["source_name"])
        if not item["keywords"]:
            item["keywords"] = server.derive_keywords(
                item.get("evidence_kind"),
                item.get("original_content"),
                item.get("translated_content"),
                item["metadata"],
                route=item.get("route_key"),
                source=item.get("source_key"),
                limit=24,
            )
        normalized.append(item)
    return dedupe_records(normalized)


def load_firecrawl_search_records(directory=FIRECRAWL_DIR, seed=None):
    directory = Path(directory)
    seed = seed or load_seed()
    records = []
    if not directory.exists():
        return records

    for path in sorted(directory.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for result in (data.get("data") or {}).get("web", []):
            title = clean_text(result.get("title"))
            description = clean_text(result.get("description"))
            url = result.get("url", "")
            source_key, source_name, source_type = source_details_for_url(url, title)
            company = company_from_search(seed, path.stem, title, description, url)
            text = f"{title} {description}"
            records.append(
                make_record(
                    source_key=source_key,
                    source_name=source_name,
                    source_type=source_type,
                    company_name=company,
                    evidence_kind="firecrawl_search_result",
                    original_content=f"Firecrawl search result: {title}. Description: {description}. URL: {url}",
                    translated_content="Cached public search-result evidence used to support DFDS source and competitor benchmarking.",
                    route_key=classify_route(text),
                    rating=parse_trust_score(title, description),
                    review_count=parse_review_count_text(f"{title} {description}"),
                    url=url,
                    metadata={
                        "evidence_type": "firecrawl_search_result",
                        "import_batch": "firecrawl_cache",
                        "collection_method": "firecrawl_search_cache",
                        "cache_file": path.name,
                        "position": result.get("position"),
                        "title": title,
                        "description": description,
                    },
                    extra_keywords=["firecrawl", "search-result"],
                )
            )
    return dedupe_records(records)


def dedupe_records(records):
    deduped = []
    seen = set()
    for record in records:
        content = " ".join(str(record.get("original_content", "")).split()).lower()
        key = (record.get("source_key", ""), content)
        if not content or key in seen:
            continue
        seen.add(key)
        deduped.append(record)
    return deduped


def build_public_dataset_records(include_cache=True, include_firecrawl=True, include_smalltalk=True, only_smalltalk=False):
    seed = load_seed()
    records = []
    if only_smalltalk:
        records.extend(server.build_smalltalk_records())
    else:
        records.extend(build_seed_public_records(seed))
        if include_smalltalk:
            records.extend(server.build_smalltalk_records())
        if include_cache:
            records.extend(load_cached_keyword_records())
        if include_firecrawl:
            records.extend(load_firecrawl_search_records(seed=seed))
    return dedupe_records(records)


def _metadata_flag(metadata, key):
    value = metadata.get(key)
    return value is True or (isinstance(value, str) and value.lower() == "true")


def record_provenance(record):
    metadata = record.get("metadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}

    record_source_tier = record.get("source_tier")
    metadata_source_tier = metadata.get("source_tier")
    metadata_is_synthetic = (
        _metadata_flag(metadata, "synthetic_source")
        or _metadata_flag(metadata, "synthetic")
        or _metadata_flag(metadata, "is_synthetic")
    )
    synthetic_marker = (
        bool(record.get("is_synthetic"))
        or metadata_is_synthetic
        or record_source_tier == "synthetic_demo"
        or metadata_source_tier == "synthetic_demo"
    )
    if synthetic_marker:
        source_tier = "synthetic_demo"
        is_synthetic = True
    else:
        source_tier = record_source_tier or metadata_source_tier or "public_snapshot"
        is_synthetic = False

    source_version = record.get("source_version") or metadata.get("source_version") or "legacy-v1"
    return source_tier, is_synthetic, source_version


def evidence_upsert_sql():
    return """
        INSERT INTO evidence_items (
          source_id, company_id, route_id, evidence_kind, original_content, translated_content,
          rating, review_count, published_at, url, metadata, keywords, embedding,
          source_tier, is_synthetic, source_version
        )
        VALUES (
          %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::text[], %s,
          %s, %s, %s
        )
        ON CONFLICT (source_id, original_content) DO UPDATE
        SET company_id = EXCLUDED.company_id,
            route_id = EXCLUDED.route_id,
            evidence_kind = EXCLUDED.evidence_kind,
            translated_content = EXCLUDED.translated_content,
            rating = EXCLUDED.rating,
            review_count = EXCLUDED.review_count,
            published_at = EXCLUDED.published_at,
            url = EXCLUDED.url,
            metadata = EXCLUDED.metadata,
            keywords = EXCLUDED.keywords,
            embedding = EXCLUDED.embedding,
            source_tier = EXCLUDED.source_tier,
            is_synthetic = EXCLUDED.is_synthetic,
            source_version = EXCLUDED.source_version
    """


def upsert_records(conn, records):
    summary = {"records": len(records), "inserted": 0, "updated": 0}
    with conn.cursor() as cur:
        for record in records:
            source_tier, is_synthetic, source_version = record_provenance(record)
            company_id = server.insert_company(
                cur,
                record.get("company_name") or "DFDS",
                is_baseline=(record.get("company_name") or "DFDS") == "DFDS",
            )
            route_id = server.insert_route(
                cur,
                record.get("route_key") or "all",
                route_display_name(record.get("route_key") or "all"),
                "Imported public dataset evidence route.",
            )
            source_id = server.insert_source(
                cur,
                record["source_key"],
                record["source_name"],
                record["source_type"],
                record.get("source_status", "Collected"),
                source_url=record.get("url", ""),
                notes=record.get(
                    "source_notes",
                    "Imported by public_dataset_import.py from local public dataset cache, seed snapshots, and playbook cards.",
                ),
                last_checked_at=datetime.now(timezone.utc).date().isoformat(),
            )
            exists = cur.execute(
                """
                SELECT 1
                FROM evidence_items
                WHERE source_id = %s AND original_content = %s
                """,
                (source_id, record["original_content"]),
            ).fetchone()
            text_for_vector = " ".join(
                [
                    record.get("evidence_kind", ""),
                    record.get("original_content", ""),
                    record.get("translated_content", ""),
                    json.dumps(record.get("metadata", {}), ensure_ascii=False),
                    " ".join(record.get("keywords", [])),
                ]
            )
            cur.execute(
                evidence_upsert_sql(),
                (
                    source_id,
                    company_id,
                    route_id,
                    record["evidence_kind"],
                    record["original_content"],
                    record.get("translated_content"),
                    record.get("rating"),
                    record.get("review_count"),
                    record.get("published_at"),
                    record.get("url", ""),
                    json.dumps(record.get("metadata", {}), ensure_ascii=False),
                    record.get("keywords", []),
                    server.vectorize_text(text_for_vector),
                    source_tier,
                    is_synthetic,
                    source_version,
                ),
            )
            if exists:
                summary["updated"] += 1
            else:
                summary["inserted"] += 1
    conn.commit()
    return summary


def summarize_records(records):
    return {
        "records": len(records),
        "by_source": dict(sorted(Counter(record["source_key"] for record in records).items())),
        "by_kind": dict(sorted(Counter(record["evidence_kind"] for record in records).items())),
    }


def run_import(args):
    records = build_public_dataset_records(
        include_cache=not args.skip_cache,
        include_firecrawl=not args.skip_firecrawl,
        include_smalltalk=True,
        only_smalltalk=args.only_smalltalk,
    )
    summary = summarize_records(records)
    if args.dry_run:
        summary.update({"inserted": 0, "updated": 0})
        return summary

    server.load_local_env()
    conn = server.connect_db(register=False)
    if conn is None:
        raise RuntimeError("DATABASE_URL or psycopg is unavailable; cannot import public datasets")
    try:
        server.execute_schema(conn)
        if server.register_vector is not None:
            server.register_vector(conn)
        if not args.only_smalltalk:
            server.seed_database(conn)
        result = upsert_records(conn, records)
        server.seed_project_memories(conn)
        server.analyze_database(conn)
        summary.update(result)
    finally:
        conn.close()
    return summary


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Clean and import cached DFDS public datasets into PostgreSQL.")
    parser.add_argument("--dry-run", action="store_true", help="Build records without writing to PostgreSQL.")
    parser.add_argument("--skip-cache", action="store_true", help="Skip work/public_keyword_raw normalized records.")
    parser.add_argument("--skip-firecrawl", action="store_true", help="Skip .firecrawl search-result cache records.")
    parser.add_argument("--only-smalltalk", action="store_true", help="Import only the Mia smalltalk playbook cards.")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    summary = run_import(args)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

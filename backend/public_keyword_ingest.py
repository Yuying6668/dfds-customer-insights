#!/usr/bin/env python3
import argparse
import html
import json
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import server

try:
    import certifi
except ImportError:
    certifi = None


ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "data" / "seed.json"
RAW_DIR = ROOT / "work" / "public_keyword_raw"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)
HTTPS_CONTEXT = ssl.create_default_context(cafile=certifi.where()) if certifi else ssl.create_default_context()

CURATED_PUBLIC_PAGES = [
    {
        "title": "DFDS ferry disruption advice",
        "url": "https://www.dfds.com/en-gb/passenger-ferries/passenger-information/disruption",
        "note": "Official DFDS passenger disruption advice for Dover-France, Operation Stack, passport controls, and congestion keywords.",
    },
    {
        "title": "DFDS check-in and boarding",
        "url": "https://www.dfds.com/en/passenger-ferries/passenger-information/check-in-and-boarding",
        "note": "Official DFDS check-in and boarding information covering Dover-Calais, Newhaven-Dieppe, controls, foot passengers, pets, and assistance.",
    },
    {
        "title": "DFDS Newhaven to Dieppe route page",
        "url": "https://www.dfds.com/en-gb/passenger-ferries/ferry-crossings/ferries-to-france/newhaven-dieppe",
        "note": "Official route information for Newhaven-Dieppe, onboard facilities, pets, discounts, construction notes, and travel planning.",
    },
    {
        "title": "Government of Jersey ferry concession agreement",
        "url": "https://www.gov.je/Travel/MaritimeAviation/FerryConcession/pages/agreement.aspx",
        "note": "Public authority page covering DFDS Jersey service obligations, cancellations, delays, customer satisfaction, and performance monitoring.",
    },
    {
        "title": "DFDS contact and complaints information",
        "url": "https://www.dfds.com/en-gb/passenger-ferries/customer-service/contact?aid=680",
        "note": "Official DFDS customer service page covering contact channels, customer care, complaints, lost property, and response expectations.",
    },
    {
        "title": "Guardian DFDS onboard incident report",
        "url": "https://www.theguardian.com/uk-news/2025/nov/12/ferry-company-apologises-pornographic-film-dfds",
        "note": "Public news report about a DFDS onboard incident and apology on a France-UK service.",
    },
    {
        "title": "Washington Post Dover border-check delay report",
        "url": "https://www.washingtonpost.com/world/2026/05/23/eu-border-checks-suspended-dover-port-traffic-delays/b8ca04f6-56c4-11f1-9c40-7a0a12d9e745_story.html",
        "note": "Public news report about Port of Dover border checks, long passenger waits, and ferry-to-France disruption.",
    },
]


@dataclass
class PublicRecord:
    source_key: str
    source_name: str
    source_type: str
    evidence_kind: str
    title: str
    content: str
    business_meaning: str
    url: str
    published_at: str = ""
    rating: float | None = None
    review_count: int | None = None
    route_key: str = "all"
    journey_stage: str = ""
    sentiment: str = "mixed"
    raw: dict | None = None


CHUNK_CHAR_LIMIT = 900


def clean_text(value):
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def derive_keywords(*parts, route_key="", source_key="", journey_stage="", sentiment="", limit=18):
    metadata = {
        "journey_stage": journey_stage,
        "sentiment": sentiment,
        "source_label": source_key,
    }
    return server.derive_keywords(
        "public_keyword_record",
        " ".join(clean_text(part) for part in parts),
        "",
        metadata,
        route=route_key,
        source=source_key,
        extra=[journey_stage, sentiment],
        limit=limit,
    )


def normalize_public_record(record):
    title = clean_text(record.title)
    content = clean_text(record.content)
    if not content and not title:
        raise ValueError("public record has no usable text")
    original = content
    if title and not content.lower().startswith(title.lower()):
        original = f"{title}: {content}" if content else title

    metadata = {
        "title": title,
        "journey_stage": record.journey_stage,
        "sentiment": record.sentiment,
        "route": record.route_key,
        "source_url": record.url,
        "source_name": record.source_name,
        "raw": record.raw or {},
    }
    keywords = derive_keywords(
        title,
        content,
        record.business_meaning,
        route_key=record.route_key,
        source_key=record.source_key,
        journey_stage=record.journey_stage,
        sentiment=record.sentiment,
    )
    return {
        "source_key": record.source_key,
        "source_name": record.source_name,
        "source_type": record.source_type,
        "evidence_kind": record.evidence_kind,
        "original_content": original,
        "translated_content": clean_text(record.business_meaning),
        "rating": record.rating,
        "review_count": record.review_count,
        "published_at": record.published_at or None,
        "url": record.url,
        "route_key": record.route_key or "all",
        "keywords": keywords,
        "metadata": metadata,
    }


def chunk_source_text(record):
    raw = (record.get("metadata") or {}).get("raw") or {}
    title = clean_text(raw.get("title_raw") or record.get("metadata", {}).get("title") or "")
    content = raw.get("content_raw")
    if content is None or not str(content).strip():
        content = record.get("original_content") or ""
    return title, str(content or "")


def split_sentences(text):
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    if not text:
        return []
    parts = re.split(r"(?<=[。！？!?\.])\s+", text)
    sentences = [part.strip() for part in parts if part.strip()]
    return sentences or [text]


def split_long_text(text, max_chars=CHUNK_CHAR_LIMIT):
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    sentence_chunks = []
    for sentence in split_sentences(text):
        if len(sentence) <= max_chars:
            sentence_chunks.append(sentence)
            continue
        start = 0
        while start < len(sentence):
            end = min(start + max_chars, len(sentence))
            if end < len(sentence):
                boundary = sentence.rfind(" ", start, end)
                if boundary > start + max_chars * 0.5:
                    end = boundary
            piece = sentence[start:end].strip()
            if piece:
                sentence_chunks.append(piece)
            start = end if end > start else end + 1
    return sentence_chunks


def chunk_text(text, max_chars=CHUNK_CHAR_LIMIT):
    text = str(text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return []

    paragraphs = [part.strip() for part in re.split(r"\n\s*\n+", text) if part.strip()]
    if not paragraphs:
        paragraphs = [text]

    chunks = []
    current = []
    current_len = 0

    def flush_current():
        nonlocal current, current_len
        if current:
            chunks.append("\n\n".join(current).strip())
        current = []
        current_len = 0

    for paragraph in paragraphs:
        pieces = [paragraph]
        if len(paragraph) > max_chars:
            pieces = split_long_text(paragraph, max_chars=max_chars)
        for piece in pieces:
            piece = piece.strip()
            if not piece:
                continue
            piece_len = len(piece)
            if current and current_len + 2 + piece_len > max_chars:
                flush_current()
            if piece_len > max_chars:
                chunks.extend(split_long_text(piece, max_chars=max_chars))
                continue
            current.append(piece)
            current_len += piece_len + (2 if current_len else 0)

    flush_current()
    return chunks or [text]


def build_chunk_records(record, max_chars=CHUNK_CHAR_LIMIT):
    title, content = chunk_source_text(record)
    chunks = chunk_text(content, max_chars=max_chars)
    if not chunks:
        chunks = [content.strip() or title]
    if len(chunks) == 1:
        chunk = chunks[0]
        item = dict(record)
        metadata = dict(item.get("metadata") or {})
        metadata["chunk_strategy"] = "record"
        metadata["chunk_index"] = 1
        metadata["chunk_count"] = 1
        item["metadata"] = metadata
        item["keywords"] = derive_keywords(
            item["original_content"],
            item.get("translated_content"),
            route_key=item.get("route_key", "all"),
            source_key=item.get("source_key", ""),
            journey_stage=metadata.get("journey_stage", ""),
            sentiment=metadata.get("sentiment", ""),
        )
        return [item]

    chunk_count = len(chunks)
    chunk_records = []
    for index, chunk in enumerate(chunks, start=1):
        item = dict(record)
        metadata = dict(item.get("metadata") or {})
        metadata["chunk_strategy"] = "paragraph_then_sentence"
        metadata["chunk_index"] = index
        metadata["chunk_count"] = chunk_count
        item["metadata"] = metadata
        if title and not chunk.lower().startswith(title.lower()):
            item["original_content"] = f"{title}: {chunk}"
        else:
            item["original_content"] = chunk
        item["keywords"] = derive_keywords(
            item["original_content"],
            item.get("translated_content"),
            route_key=item.get("route_key", "all"),
            source_key=item.get("source_key", ""),
            journey_stage=metadata.get("journey_stage", ""),
            sentiment=metadata.get("sentiment", ""),
        )
        chunk_records.append(item)
    return chunk_records


def dedupe_records(records):
    deduped = []
    seen = set()
    for record in records:
        key = (
            record.get("source_key", ""),
            re.sub(r"\s+", " ", record.get("original_content", "")).strip().lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(record)
    return deduped


def save_raw(name, content):
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / name
    if isinstance(content, (dict, list)):
        path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        path.write_text(str(content), encoding="utf-8")
    return path


def fetch_url(url, timeout=25):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json,text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout, context=HTTPS_CONTEXT) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def fetch_json(url, timeout=25):
    return json.loads(fetch_url(url, timeout=timeout))


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


def classify_journey_stage(text):
    text = str(text or "").lower()
    if any(term in text for term in ["login", "booking", "bookings", "check-in", "check in", "app", "account"]):
        return "digital_pre_trip"
    if any(term in text for term in ["delay", "queue", "passport", "border", "boarding", "terminal"]):
        return "terminal_boarding"
    if any(term in text for term in ["cabin", "food", "onboard", "crew", "staff", "entertainment"]):
        return "onboard_experience"
    if any(term in text for term in ["refund", "compensation", "cancelled", "disruption"]):
        return "disruption_recovery"
    return "travel_planning"


def classify_sentiment(text, rating=None):
    if rating is not None:
        if rating >= 4:
            return "positive"
        if rating <= 2:
            return "negative"
        return "mixed"
    text = str(text or "").lower()
    negative_terms = ["delay", "cancel", "problem", "failed", "missing", "loop", "unavailable", "queue", "complaint"]
    positive_terms = ["helpful", "smooth", "good", "great", "excellent", "easy", "comfortable", "friendly"]
    negative_hits = sum(term in text for term in negative_terms)
    positive_hits = sum(term in text for term in positive_terms)
    if negative_hits > positive_hits:
        return "negative"
    if positive_hits > negative_hits:
        return "positive"
    return "mixed"


def business_meaning_for(text, source_name, sentiment, journey_stage):
    stage_label = journey_stage.replace("_", " ")
    if sentiment == "negative":
        return f"{source_name} public evidence adds a negative {stage_label} keyword signal for DFDS monitoring."
    if sentiment == "positive":
        return f"{source_name} public evidence adds a positive {stage_label} keyword signal that can support route or brand proof points."
    return f"{source_name} public evidence adds a mixed {stage_label} keyword signal for DFDS monitoring."


def parse_float(value):
    match = re.search(r"\d+(?:\.\d+)?", str(value or ""))
    return float(match.group(0)) if match else None


def parse_date(value):
    text = str(value or "")
    match = re.search(r"(\d{4})-(\d{2})-(\d{2})", text)
    if match:
        return match.group(0)
    match = re.search(r"(\d{4})(\d{2})(\d{2})", text)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    return ""


def collect_apple_reviews(limit=25):
    countries = ["gb", "dk", "de", "fr", "nl", "no", "se", "us", "ie"]
    records = []
    errors = []
    for country in countries:
        url = f"https://itunes.apple.com/{country}/rss/customerreviews/id=6474616110/sortBy=mostRecent/json"
        try:
            data = fetch_json(url)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            errors.append({"country": country, "error": str(exc)})
            continue
        save_raw(f"apple-app-store-reviews-{country}.json", data)
        entries = data.get("feed", {}).get("entry", [])
        if isinstance(entries, dict):
            entries = [entries]

        for entry in entries:
            rating = parse_float((entry.get("im:rating") or {}).get("label"))
            if rating is None:
                continue
            title = clean_text((entry.get("title") or {}).get("label"))
            content = clean_text((entry.get("content") or {}).get("label"))
            text = f"{title} {content}"
            route = classify_route(text)
            stage = classify_journey_stage(text)
            sentiment = classify_sentiment(text, rating)
            records.append(
                PublicRecord(
                    source_key="apple-app-store",
                    source_name="Apple App Store Reviews",
                    source_type="app_store",
                    evidence_kind="app_review_public",
                    title=title,
                    content=content,
                    business_meaning=business_meaning_for(text, "Apple App Store", sentiment, stage),
                    url=url,
                    published_at=parse_date((entry.get("updated") or {}).get("label")),
                    rating=rating,
                    route_key=route,
                    journey_stage=stage,
                    sentiment=sentiment,
                    raw={
                        "id": (entry.get("id") or {}).get("label"),
                        "author": ((entry.get("author") or {}).get("name") or {}).get("label"),
                        "country": country,
                        "vote_sum": (entry.get("im:voteSum") or {}).get("label"),
                        "vote_count": (entry.get("im:voteCount") or {}).get("label"),
                        "title_raw": (entry.get("title") or {}).get("label"),
                        "content_raw": (entry.get("content") or {}).get("label"),
                    },
                )
            )
            if len(records) >= limit:
                if errors:
                    save_raw("apple-collection-errors.json", errors)
                return records
        time.sleep(0.5)
    if errors:
        save_raw("apple-collection-errors.json", errors)
    return records


def collect_reddit_discussions(limit=15):
    queries = [
        "https://www.reddit.com/search.json?q=DFDS%20ferry&sort=new&t=year&limit=15",
        "https://www.reddit.com/r/travel/search.json?q=DFDS%20ferry&restrict_sr=1&sort=new&t=all&limit=15",
    ]
    records = []
    for index, url in enumerate(queries, start=1):
        data = fetch_json(url)
        save_raw(f"reddit-search-{index}.json", data)
        for child in data.get("data", {}).get("children", []):
            item = child.get("data", {})
            title = clean_text(item.get("title"))
            content = clean_text(item.get("selftext") or item.get("link_flair_text") or "")
            text = f"{title} {content}"
            if "dfds" not in text.lower():
                continue
            created = item.get("created_utc")
            published_at = ""
            if created:
                published_at = datetime.fromtimestamp(float(created), tz=timezone.utc).date().isoformat()
            stage = classify_journey_stage(text)
            sentiment = classify_sentiment(text)
            records.append(
                PublicRecord(
                    source_key="reddit",
                    source_name="Reddit",
                    source_type="discussion",
                    evidence_kind="reddit_discussion_public",
                    title=title,
                    content=content,
                    business_meaning=business_meaning_for(text, "Reddit", sentiment, stage),
                    url=urllib.parse.urljoin("https://www.reddit.com", item.get("permalink", "")),
                    published_at=published_at,
                    route_key=classify_route(text),
                    journey_stage=stage,
                    sentiment=sentiment,
                    raw={
                        "subreddit": item.get("subreddit"),
                        "score": item.get("score"),
                        "num_comments": item.get("num_comments"),
                        "post_hint": item.get("post_hint"),
                        "title_raw": item.get("title"),
                        "content_raw": item.get("selftext") or item.get("link_flair_text") or "",
                    },
                )
            )
            if len(records) >= limit:
                return records
        time.sleep(1)
    return records


def collect_gdelt_news(limit=25):
    time.sleep(6)
    params = urllib.parse.urlencode(
        {
            "query": "DFDS ferry",
            "mode": "ArtList",
            "format": "json",
            "maxrecords": str(limit),
            "sort": "HybridRel",
        }
    )
    url = f"https://api.gdeltproject.org/api/v2/doc/doc?{params}"
    raw = fetch_url(url, timeout=35)
    if not raw.lstrip().startswith("{"):
        save_raw("gdelt-dfds-news-error.txt", raw)
        return []
    data = json.loads(raw)
    save_raw("gdelt-dfds-news.json", data)
    records = []
    for article in data.get("articles", [])[:limit]:
        title = clean_text(article.get("title"))
        if not title or "dfds" not in title.lower():
            continue
        source_url = article.get("url", url)
        text = f"{title} {article.get('domain', '')}"
        stage = classify_journey_stage(text)
        sentiment = classify_sentiment(text)
        records.append(
            PublicRecord(
                source_key="gdelt-news",
                source_name="GDELT News Search",
                source_type="news",
                evidence_kind="news_public_signal",
                title=title,
                content=clean_text(article.get("sourceCountry") or article.get("domain") or ""),
                business_meaning=business_meaning_for(text, "GDELT News Search", sentiment, stage),
                url=source_url,
                published_at=parse_date(article.get("seendate")),
                route_key=classify_route(text),
                journey_stage=stage,
                sentiment=sentiment,
                raw={
                    "domain": article.get("domain"),
                    "language": article.get("language"),
                    "source_country": article.get("sourceCountry"),
                    "seendate": article.get("seendate"),
                },
            )
        )
    return records


def extract_page_title(markup):
    match = re.search(r"<title[^>]*>(.*?)</title>", markup, re.IGNORECASE | re.DOTALL)
    return clean_text(match.group(1)) if match else ""


def extract_meta_description(markup):
    patterns = [
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:description["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, markup, re.IGNORECASE | re.DOTALL)
        if match:
            return clean_text(match.group(1))
    return ""


def source_key_for_url(url, title=""):
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
    if "washingtonpost.com" in label:
        return "company-news", "Company News", "news"
    if "dfds.com" in label:
        return "dfds-official", "DFDS Official Passenger Pages", "operator_public_page"
    if "gov.je" in label:
        return "jersey-government", "Government of Jersey", "public_authority"
    return "public-web", "Public Web", "public_source"


def collect_seed_page_summaries(limit=16):
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    sources = seed.get("sources", []) + CURATED_PUBLIC_PAGES
    records = []
    errors = []
    for index, source in enumerate(sources[:limit], start=1):
        url = source.get("url", "")
        if not url.startswith("http"):
            continue
        try:
            markup = fetch_url(url, timeout=25)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            errors.append({"url": url, "title": source.get("title"), "error": str(exc)})
            continue
        save_raw(f"source-page-{index}.html", markup)
        page_title = extract_page_title(markup) or clean_text(source.get("title"))
        description = extract_meta_description(markup) or clean_text(source.get("note"))
        if not page_title and not description:
            continue
        source_key, source_name, source_type = source_key_for_url(url, page_title)
        if source_key == "reddit" and "please wait for verification" in page_title.lower():
            errors.append({"url": url, "title": source.get("title"), "error": "Skipped verification page"})
            continue
        text = f"{page_title} {description}"
        stage = classify_journey_stage(text)
        sentiment = classify_sentiment(text)
        records.append(
            PublicRecord(
                source_key=source_key,
                source_name=source_name,
                source_type=source_type,
                evidence_kind="public_page_summary",
                title=page_title,
                content=description,
                business_meaning=business_meaning_for(text, source_name, sentiment, stage),
                url=url,
                route_key=classify_route(text),
                journey_stage=stage,
                sentiment=sentiment,
                raw={
                    "seed_title": source.get("title"),
                    "seed_note": source.get("note"),
                    "collection_method": "html_title_meta_description",
                    "title_raw": source.get("title"),
                    "content_raw": description or source.get("note") or "",
                },
            )
        )
        time.sleep(0.5)
    if errors:
        save_raw("page-collection-errors.json", errors)
    return records


def normalize_records(records):
    normalized = []
    for record in records:
        try:
            normalized.extend(build_chunk_records(normalize_public_record(record)))
        except ValueError:
            continue
    return dedupe_records(normalized)


def route_display_name(key):
    return {
        "all": "All signals",
        "dover-calais": "Dover-Calais",
        "newhaven-dieppe": "Newhaven-Dieppe",
        "newcastle-ijmuiden": "Newcastle-IJmuiden",
        "jersey": "Jersey / Channel Islands",
    }.get(key, key.replace("-", " ").title())


def insert_records(conn, records):
    inserted = 0
    with conn.cursor() as cur:
        dfds_id = server.insert_company(cur, "DFDS", is_baseline=True)
        for record in records:
            route_id = server.insert_route(
                cur,
                record["route_key"],
                route_display_name(record["route_key"]),
                "Imported public keyword evidence route.",
            )
            source_id = server.insert_source(
                cur,
                record["source_key"],
                record["source_name"],
                record["source_type"],
                "Collected",
                source_url=record["url"],
                notes="Imported by public_keyword_ingest.py from publicly reachable web data.",
                last_checked_at=datetime.now(timezone.utc).date().isoformat(),
            )
            row_count = server.insert_evidence(
                cur,
                source_id,
                dfds_id,
                route_id,
                record["evidence_kind"],
                record["original_content"],
                record["translated_content"],
                record["rating"],
                record["review_count"],
                record["published_at"],
                record["url"],
                record["metadata"],
                record["keywords"],
            )
            inserted += int(row_count or 0)
    conn.commit()
    return inserted


def backfill_existing_keywords(conn):
    updated = 0
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              e.id, e.evidence_kind, e.original_content, e.translated_content,
              e.metadata, COALESCE(r.route_key, 'all') AS route_key, s.source_key
            FROM evidence_items e
            JOIN sources s ON s.id = e.source_id
            LEFT JOIN routes r ON r.id = e.route_id
            WHERE e.keywords = '{}'::text[]
            """
        )
        rows = cur.fetchall()
        for row in rows:
            keywords = server.derive_keywords(
                row["evidence_kind"],
                row["original_content"],
                row["translated_content"],
                row["metadata"],
                route=row["route_key"],
                source=row["source_key"],
            )
            cur.execute("UPDATE evidence_items SET keywords = %s::text[] WHERE id = %s", (keywords, row["id"]))
            updated += cur.rowcount
            server.replace_evidence_keywords(
                cur,
                row["id"],
                keywords,
                {
                    "source": "evidence_items.keywords_backfill",
                    "evidence_kind": row["evidence_kind"],
                },
            )
    conn.commit()
    return updated


def backfill_keyword_dimension_tables(conn):
    refreshed = 0
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, evidence_kind, keywords, published_at
            FROM evidence_items
            WHERE keywords <> '{}'::text[]
            ORDER BY id
            """
        )
        rows = cur.fetchall()
        for row in rows:
            refreshed += server.replace_evidence_keywords(
                cur,
                row["id"],
                row["keywords"],
                {
                    "source": "evidence_items.keywords_dimension_backfill",
                    "evidence_kind": row["evidence_kind"],
                    "published_at": str(row["published_at"] or ""),
                },
            )
    conn.commit()
    return refreshed


def collect_public_records(args):
    collectors = [
        ("apple", lambda: collect_apple_reviews(args.apple_limit)),
        ("gdelt", lambda: collect_gdelt_news(args.news_limit)),
        ("reddit", lambda: collect_reddit_discussions(args.reddit_limit)),
        ("pages", lambda: collect_seed_page_summaries(args.page_limit)),
    ]
    records = []
    errors = []
    for name, collect in collectors:
        if name in args.skip:
            continue
        try:
            records.extend(collect())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            errors.append({"collector": name, "error": str(exc)})
    if errors:
        save_raw("collection-errors.json", errors)
    return records, errors


def run_import(args):
    server.load_local_env()
    records, errors = collect_public_records(args)
    normalized = normalize_records(records)
    save_raw("normalized-public-keyword-records.json", normalized)

    summary = {
        "collected_records": len(records),
        "normalized_records": len(normalized),
        "collection_errors": errors,
        "backfilled_keywords": 0,
        "keyword_links_refreshed": 0,
        "inserted_records": 0,
    }

    if args.dry_run:
        return summary

    conn = server.connect_db(register=False)
    if conn is None:
        raise RuntimeError("DATABASE_URL or psycopg is unavailable; cannot insert public keyword data")
    try:
        server.execute_schema(conn)
        if server.register_vector is not None:
            server.register_vector(conn)
        summary["backfilled_keywords"] = backfill_existing_keywords(conn)
        summary["inserted_records"] = insert_records(conn, normalized)
        summary["keyword_links_refreshed"] = backfill_keyword_dimension_tables(conn)
        server.analyze_database(conn)
    finally:
        conn.close()
    return summary


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Collect, clean, keyword-tag, and import DFDS public evidence into PostgreSQL.")
    parser.add_argument("--dry-run", action="store_true", help="Collect and normalize data without writing to PostgreSQL.")
    parser.add_argument("--apple-limit", type=int, default=25)
    parser.add_argument("--news-limit", type=int, default=25)
    parser.add_argument("--reddit-limit", type=int, default=15)
    parser.add_argument("--page-limit", type=int, default=40)
    parser.add_argument("--skip", action="append", default=[], choices=["apple", "gdelt", "reddit", "pages"])
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    summary = run_import(args)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

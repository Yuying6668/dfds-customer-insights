#!/usr/bin/env python3
"""Clean, slice, and import synthetic passenger-profile evidence for Mia."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
for path in (ROOT, BACKEND_DIR):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

import public_dataset_import
import server

DEFAULT_PROFILE_DIR = ROOT / "data" / "passenger_profile"
SOURCE_KEY = "synthetic-passenger-profile-pg"
SOURCE_NAME = "Synthetic Passenger Profile PG"
SOURCE_TYPE = "synthetic_profile_database"
SOURCE_STATUS = "Ready"


def read_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def as_bool(value) -> bool:
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def as_float(value, default=0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def as_int(value, default=0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def load_clean_trips(profile_dir=DEFAULT_PROFILE_DIR) -> list[dict]:
    profile_dir = Path(profile_dir)
    passengers = {row["passenger_id"]: row for row in read_csv(profile_dir / "dim_passenger.csv")}
    routes = {row["route_id"]: row for row in read_csv(profile_dir / "dim_route.csv")}
    products = {row["product_id"]: row for row in read_csv(profile_dir / "dim_product.csv")}
    contexts = {row["travel_context_id"]: row for row in read_csv(profile_dir / "dim_travel_context.csv")}
    channels = {row["booking_channel_id"]: row for row in read_csv(profile_dir / "dim_booking_channel.csv")}

    clean_rows = []
    for trip in read_csv(profile_dir / "fact_passenger_trips.csv"):
        passenger = passengers.get(trip.get("passenger_id"))
        route = routes.get(trip.get("route_id"))
        product = products.get(trip.get("product_id"))
        context = contexts.get(trip.get("travel_context_id"))
        channel = channels.get(trip.get("booking_channel_id"))
        if not all([passenger, route, product, context, channel]):
            continue

        party_size = as_int(trip.get("party_size"))
        total_order_value = as_float(trip.get("total_order_value"))
        confidence = as_float(trip.get("synthetic_confidence_score"))
        if party_size < 1 or party_size > 8 or total_order_value < 0 or confidence < 0.60:
            continue

        clean_rows.append(
            {
                **trip,
                "party_size": party_size,
                "ticket_price": as_float(trip.get("ticket_price")),
                "ancillary_spend": as_float(trip.get("ancillary_spend")),
                "total_order_value": total_order_value,
                "vehicle_included": as_bool(trip.get("vehicle_included")),
                "cabin_booked_flag": as_bool(trip.get("cabin_booked_flag")),
                "discount_used": as_bool(trip.get("discount_used")),
                "repeat_trip_flag": as_bool(trip.get("repeat_trip_flag")),
                "synthetic_confidence_score": confidence,
                "passenger": passenger,
                "route": route,
                "product": product,
                "context": context,
                "channel": channel,
            }
        )
    return clean_rows


def pct(numerator, denominator) -> float:
    return round((numerator / denominator) * 100, 1) if denominator else 0.0


def avg(values) -> float:
    values = list(values)
    return round(sum(values) / len(values), 2) if values else 0.0


def build_segment_slices(clean_trips: list[dict]) -> list[dict]:
    grouped = defaultdict(list)
    for row in clean_trips:
        grouped[(row["passenger"]["segment_label"], row["route"]["route_cluster"], row["route"]["route_name"])].append(row)

    slices = []
    for (segment, route_cluster, route_name), rows in grouped.items():
        slices.append(
            {
                "segment_label": segment,
                "route_cluster": route_cluster,
                "route_name": route_name,
                "trip_count": len(rows),
                "passenger_count": len({row["passenger_id"] for row in rows}),
                "avg_order_value": avg(row["total_order_value"] for row in rows),
                "avg_ancillary_spend": avg(row["ancillary_spend"] for row in rows),
                "vehicle_share_pct": pct(sum(row["vehicle_included"] for row in rows), len(rows)),
                "cabin_share_pct": pct(sum(row["cabin_booked_flag"] for row in rows), len(rows)),
                "repeat_trip_share_pct": pct(sum(row["repeat_trip_flag"] for row in rows), len(rows)),
                "avg_confidence": round(sum(row["synthetic_confidence_score"] for row in rows) / len(rows), 3),
            }
        )
    return sorted(slices, key=lambda item: item["trip_count"], reverse=True)


def recommendation_for_slice(slice_row: dict) -> str:
    if slice_row["avg_order_value"] >= 300:
        return "Prioritize premium cabin, mini-cruise, lounge, and comfort messaging."
    if slice_row["vehicle_share_pct"] >= 75:
        return "Prioritize vehicle-first booking, parking, boarding, and family packing guidance."
    if slice_row["cabin_share_pct"] >= 60:
        return "Prioritize cabin clarity, onboard experience, and overnight comfort content."
    return "Prioritize price clarity, flexible ticketing, and short-break conversion messaging."


def make_record(kind, title, content, metadata, extra_keywords=None):
    keywords = server.derive_keywords(
        kind,
        content,
        json.dumps(metadata, ensure_ascii=False),
        metadata,
        route="all",
        source=SOURCE_KEY,
        extra=["passenger-profile", "user-profile", "segmentation", *(extra_keywords or [])],
        limit=24,
    )
    for keyword in reversed(["passenger-profile", *(extra_keywords or [])]):
        normalized = server.normalize_keyword(keyword)
        if normalized and normalized not in keywords:
            keywords.insert(0, normalized)
    return {
        "source_key": SOURCE_KEY,
        "source_name": SOURCE_NAME,
        "source_type": SOURCE_TYPE,
        "source_status": SOURCE_STATUS,
        "source_notes": "Synthetic PG star-schema passenger profile data for DFDS segmentation prototyping.",
        "company_name": "DFDS",
        "route_key": "all",
        "evidence_kind": kind,
        "original_content": content,
        "translated_content": title,
        "rating": None,
        "review_count": metadata.get("trip_count") or metadata.get("passenger_count"),
        "published_at": datetime.now(timezone.utc).date().isoformat(),
        "url": "",
        "metadata": metadata,
        "keywords": keywords[:24],
    }


def build_passenger_profile_records(profile_dir=DEFAULT_PROFILE_DIR) -> list[dict]:
    clean_trips = load_clean_trips(profile_dir)
    passenger_ids = {row["passenger_id"] for row in clean_trips}
    segment_counts = Counter(row["passenger"]["segment_label"] for row in clean_trips)
    route_counts = Counter(row["route"]["route_cluster"] for row in clean_trips)
    product_counts = Counter(row["product"]["product_category"] for row in clean_trips)
    context_counts = Counter(row["context"]["travel_purpose"] for row in clean_trips)

    records = [
        make_record(
            "passenger_profile_overview",
            "Synthetic passenger profile dataset",
            (
                f"Synthetic Passenger Profile PG contains {len(passenger_ids)} passengers and {len(clean_trips)} clean trips. "
                "It supports segmentation by customer profile, route affinity, travel context, product preference and booking behavior. "
                "It is synthetic and should not be treated as real DFDS CRM or survey evidence."
            ),
            {
                "evidence_type": "passenger_profile_overview",
                "passenger_count": len(passenger_ids),
                "trip_count": len(clean_trips),
                "synthetic": True,
                "actar": "Action area, Customer target, Trigger signal, Analysis, Recommendation",
            },
            ["actar"],
        )
    ]

    for segment, count in segment_counts.most_common():
        records.append(
            make_record(
                "passenger_profile_segment",
                f"{segment}",
                f"{segment} appears in {count} clean synthetic trip records, representing {pct(count, len(clean_trips))}% of trips.",
                {
                    "evidence_type": "passenger_profile_segment",
                    "segment_label": segment,
                    "trip_count": count,
                    "share_pct": pct(count, len(clean_trips)),
                    "synthetic": True,
                },
                ["segment"],
            )
        )

    for route_cluster, count in route_counts.most_common():
        records.append(
            make_record(
                "passenger_profile_route_affinity",
                f"{route_cluster} route affinity",
                f"{route_cluster} accounts for {count} clean synthetic trips, or {pct(count, len(clean_trips))}% of the passenger profile dataset.",
                {
                    "evidence_type": "passenger_profile_route_affinity",
                    "route_cluster": route_cluster,
                    "trip_count": count,
                    "share_pct": pct(count, len(clean_trips)),
                    "synthetic": True,
                },
                ["route-affinity"],
            )
        )

    for product_category, count in product_counts.most_common():
        records.append(
            make_record(
                "passenger_profile_product_preference",
                f"{product_category} preference",
                f"{product_category} accounts for {count} clean synthetic trips, or {pct(count, len(clean_trips))}% of observed product choices.",
                {
                    "evidence_type": "passenger_profile_product_preference",
                    "product_category": product_category,
                    "trip_count": count,
                    "share_pct": pct(count, len(clean_trips)),
                    "synthetic": True,
                },
                ["product-preference"],
            )
        )

    for travel_purpose, count in context_counts.most_common():
        records.append(
            make_record(
                "passenger_profile_travel_context",
                f"{travel_purpose} context",
                f"{travel_purpose} accounts for {count} clean synthetic trips, or {pct(count, len(clean_trips))}% of travel contexts.",
                {
                    "evidence_type": "passenger_profile_travel_context",
                    "travel_purpose": travel_purpose,
                    "trip_count": count,
                    "share_pct": pct(count, len(clean_trips)),
                    "synthetic": True,
                },
                ["travel-context"],
            )
        )

    for slice_row in build_segment_slices(clean_trips):
        if slice_row["trip_count"] < 50:
            continue
        recommendation = recommendation_for_slice(slice_row)
        content = (
            f"ACTAR passenger profile slice. Action area: {slice_row['route_cluster']}. "
            f"Customer target: {slice_row['segment_label']}. Trigger signal: {slice_row['trip_count']} synthetic trips on {slice_row['route_name']}, "
            f"average order value {slice_row['avg_order_value']}, vehicle share {slice_row['vehicle_share_pct']}%, cabin share {slice_row['cabin_share_pct']}%. "
            f"Analysis: this segment-route pairing indicates route and product affinity. Recommendation: {recommendation}"
        )
        records.append(
            make_record(
                "passenger_profile_actar",
                f"{slice_row['segment_label']} on {slice_row['route_cluster']}",
                content,
                {
                    "evidence_type": "passenger_profile_actar",
                    **slice_row,
                    "recommendation": recommendation,
                    "synthetic": True,
                },
                ["actar", "marketing-segmentation"],
            )
        )

    return records


def run_import(args):
    records = build_passenger_profile_records(args.profile_dir)
    summary = public_dataset_import.summarize_records(records)
    if args.dry_run:
        summary.update({"inserted": 0, "updated": 0})
        return summary

    server.load_local_env()
    conn = server.connect_db(register=False)
    if conn is None:
        raise RuntimeError("DATABASE_URL or psycopg is unavailable; cannot import passenger profile evidence")
    try:
        server.execute_schema(conn)
        if server.register_vector is not None:
            server.register_vector(conn)
        result = public_dataset_import.upsert_records(conn, records)
        server.seed_project_memories(conn)
        server.analyze_database(conn)
        summary.update(result)
    finally:
        conn.close()
    return summary


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Import synthetic passenger profile slices into Mia's evidence KB.")
    parser.add_argument("--profile-dir", type=Path, default=DEFAULT_PROFILE_DIR)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    summary = run_import(args)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

"""Deterministic, clearly marked monitoring events for the administrator demo."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import uuid


DEMO_NAMESPACE = uuid.UUID("e4c8dc2a-8ed7-4d39-a96d-6f13e580c4cf")
DEMO_BATCH = "demo_agent_monitoring_v1"
ROUTES = (
    ("dover-calais", "Dover-Calais"),
    ("newhaven-dieppe", "Newhaven-Dieppe"),
    ("newcastle-ijmuiden", "Newcastle-IJmuiden"),
    ("jersey", "Jersey / Channel Islands"),
)
USERS = ("Route operations", "Customer experience", "Revenue planning", "Service recovery", "Network analyst")
PROMPTS = (
    "Summarise the latest customer friction signals and recommended action.",
    "Which journey stage has the most negative sentiment this week?",
    "Compare service recovery themes with the prior operating period.",
    "Show the evidence behind the route delay communication trend.",
    "Draft a route operations briefing from the monitored signals.",
)


def build_demo_events(now: datetime | None = None) -> list[dict]:
    """Return 150 stable, route-distributed monitoring events for the last 24 hours."""
    anchor = (now or datetime.now(timezone.utc)).replace(second=0, microsecond=0)
    events = []
    for index in range(150):
        route_key, route_name = ROUTES[index % len(ROUTES)]
        input_tokens = 240 + ((index * 37) % 560)
        output_tokens = 135 + ((index * 29) % 420)
        events.append(
            {
                "id": str(uuid.uuid5(DEMO_NAMESPACE, f"{DEMO_BATCH}:{index}")),
                "session_id": str(uuid.uuid5(DEMO_NAMESPACE, f"{DEMO_BATCH}:session:{index}")),
                "user_key": f"demo-monitor-{index % len(USERS)}",
                "username": USERS[index % len(USERS)],
                "route_key": route_key,
                "route_name": route_name,
                "message": PROMPTS[index % len(PROMPTS)],
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
                "created_at": anchor - timedelta(minutes=index * 9 + (index % 5)),
                "retrieval_trace": {
                    "demo_agent_monitoring": True,
                    "demo_batch": DEMO_BATCH,
                    "route_key": route_key,
                    "layers": [
                        {"name": "keyword", "durationMs": 42 + ((index * 7) % 48), "records": 18 + (index % 17)},
                        {"name": "semantic", "durationMs": 84 + ((index * 11) % 92), "records": 12 + (index % 13)},
                        {"name": "rerank", "durationMs": 24 + ((index * 5) % 31), "records": 6},
                    ],
                },
            }
        )
    return events


def summarize_route_monitoring(rows: list[dict]) -> list[dict]:
    """Normalize route aggregates for the admin API and UI."""
    return [
        {
            "route_key": str(row.get("route_key") or "all"),
            "route_name": str(row.get("route_name") or row.get("route_key") or "All signals"),
            "requests": int(row.get("requests") or 0),
            "total_tokens": int(row.get("total_tokens") or 0),
            "avg_latency_ms": float(row.get("avg_latency_ms") or 0),
            "records": int(row.get("records") or 0),
            "last_seen_at": row.get("last_seen_at"),
        }
        for row in rows
    ]

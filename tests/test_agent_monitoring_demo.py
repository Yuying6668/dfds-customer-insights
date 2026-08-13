import unittest
from collections import Counter
from datetime import datetime, timedelta, timezone

import server

from backend.agent_monitoring_demo import DEMO_EVENT_COUNT, build_demo_events, summarize_route_monitoring


class SeedCursor:
    def __init__(self):
        self.statements = []

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, query, params=()):
        self.statements.append((query, params))

    def fetchone(self):
        return {"id": self.statements[-1][1][0]}


class SeedConnection:
    def __init__(self):
        self.cursor_instance = SeedCursor()
        self.committed = False

    def cursor(self):
        return self.cursor_instance

    def commit(self):
        self.committed = True


class AgentMonitoringDemoTests(unittest.TestCase):
    def test_builds_166_route_distributed_monitoring_events(self):
        events = build_demo_events()

        self.assertEqual(DEMO_EVENT_COUNT, 166)
        self.assertEqual(len(events), DEMO_EVENT_COUNT)
        self.assertEqual(
            {event["route_key"] for event in events},
            {"dover-calais", "newhaven-dieppe", "newcastle-ijmuiden", "jersey"},
        )
        self.assertEqual(len({event["id"] for event in events}), DEMO_EVENT_COUNT)
        self.assertEqual(
            Counter(event["route_key"] for event in events),
            {
                "dover-calais": 42,
                "newhaven-dieppe": 42,
                "newcastle-ijmuiden": 41,
                "jersey": 41,
            },
        )
        self.assertTrue(all(event["retrieval_trace"]["demo_agent_monitoring"] for event in events))
        self.assertTrue(all(event["total_tokens"] > 0 for event in events))

    def test_keeps_all_demo_events_in_the_api_24_hour_window(self):
        anchor = datetime(2026, 8, 13, 12, 0, tzinfo=timezone.utc)
        events = build_demo_events(anchor)

        self.assertTrue(all(event["created_at"] >= anchor - timedelta(hours=24) for event in events))
        self.assertEqual(
            [event["id"] for event in events],
            [event["id"] for event in build_demo_events(anchor)],
        )

    def test_seed_refreshes_existing_deterministic_monitoring_records(self):
        conn = SeedConnection()

        server.seed_agent_monitoring_demo(conn)

        self.assertTrue(conn.committed)
        statements = {
            table: " ".join(next(query for query, _ in conn.cursor_instance.statements if f"INSERT INTO {table}" in query).split())
            for table in ("chat_sessions", "chat_messages", "rag_usage_events")
        }
        for statement in statements.values():
            self.assertIn("ON CONFLICT (id) DO UPDATE SET", statement)
            self.assertIn("created_at = EXCLUDED.created_at", statement)
        self.assertIn("updated_at = EXCLUDED.updated_at", statements["chat_sessions"])
        self.assertIn("message_text = EXCLUDED.message_text", statements["chat_messages"])
        self.assertIn("retrieval_trace = EXCLUDED.retrieval_trace", statements["rag_usage_events"])

    def test_summarizes_usage_by_route(self):
        rows = [
            {"route_key": "dover-calais", "route_name": "Dover-Calais", "requests": 38, "total_tokens": 12000, "avg_latency_ms": 140.2, "records": 900, "last_seen_at": "2026-08-13T10:00:00+00:00"},
            {"route_key": "jersey", "route_name": "Jersey / Channel Islands", "requests": 37, "total_tokens": 11000, "avg_latency_ms": 133.1, "records": 800, "last_seen_at": "2026-08-13T09:00:00+00:00"},
        ]

        summary = summarize_route_monitoring(rows)

        self.assertEqual(summary[0]["requests"], 38)
        self.assertEqual(summary[0]["route_name"], "Dover-Calais")
        self.assertEqual(summary[1]["records"], 800)


if __name__ == "__main__":
    unittest.main()

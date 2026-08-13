import unittest

from backend.agent_monitoring_demo import build_demo_events, summarize_route_monitoring


class AgentMonitoringDemoTests(unittest.TestCase):
    def test_builds_150_route_distributed_monitoring_events(self):
        events = build_demo_events()

        self.assertEqual(len(events), 150)
        self.assertEqual(
            {event["route_key"] for event in events},
            {"dover-calais", "newhaven-dieppe", "newcastle-ijmuiden", "jersey"},
        )
        self.assertEqual(len({event["id"] for event in events}), 150)
        self.assertTrue(all(event["retrieval_trace"]["demo_agent_monitoring"] for event in events))
        self.assertTrue(all(event["total_tokens"] > 0 for event in events))

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

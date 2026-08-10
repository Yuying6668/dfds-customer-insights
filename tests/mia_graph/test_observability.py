import json
import unittest

from backend.mia_graph.observability import graph_audit_record


class ObservabilityTests(unittest.TestCase):
    def test_graph_audit_never_persists_raw_text_or_identity_values(self):
        record = graph_audit_record(
            {"message": "email a@example.com", "actor_id": "u1", "evidence_ids": ["e1"]}
        )
        serialized = json.dumps(record)
        self.assertNotIn("message", record)
        self.assertNotIn("actor_id", record)
        self.assertNotIn("a@example.com", serialized)
        self.assertNotIn("u1", serialized)
        self.assertEqual(record["evidence_ids"], ["e1"])


if __name__ == "__main__":
    unittest.main()

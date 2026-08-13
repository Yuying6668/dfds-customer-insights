import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from backend.review_workflow import action_record, review_item_payload_for_graph, transition_for_action
from server import json_response_body
from server import call_deepseek


class ReviewWorkflowTests(unittest.TestCase):
    def test_actions_map_to_auditable_statuses(self):
        self.assertEqual(transition_for_action("pending_human_review", "approve")["next_status"], "approved")
        self.assertEqual(transition_for_action("pending_human_review", "correct")["next_status"], "corrected")
        self.assertEqual(transition_for_action("pending_human_review", "reject")["next_status"], "rejected")
        self.assertEqual(transition_for_action("approved", "withdraw")["next_status"], "withdrawn")
        self.assertEqual(transition_for_action("rejected", "request_reanalysis")["next_status"], "pending_human_review")

    def test_invalid_transition_is_rejected(self):
        with self.assertRaises(ValueError):
            transition_for_action("withdrawn", "approve")

    def test_correction_action_requires_corrected_content(self):
        with self.assertRaisesRegex(ValueError, "Correction content"):
            action_record(item_id="42", action="correct", current_status="pending_human_review", actor_id="admin", rationale="citation missing")

    def test_every_human_action_requires_a_rationale(self):
        with self.assertRaisesRegex(ValueError, "Rationale"):
            action_record(item_id="42", action="approve", current_status="pending_human_review", actor_id="admin")

    def test_review_action_datetime_is_json_serializable(self):
        body = json_response_body({"action": {"created_at": datetime(2026, 8, 10, tzinfo=timezone.utc)}})
        self.assertIn('"created_at": "2026-08-10T00:00:00+00:00"', body.decode("utf-8"))

    def test_grounded_vertical_answer_includes_compact_citations_without_an_explicit_request(self):
        context = {"evidenceItems": [{"id": "e1", "title": "Route review", "body": "Boarding delays", "source": "QA source"}]}
        with patch.dict("os.environ", {"DEEPSEEK_API_KEY": ""}, clear=False):
            status, response = call_deepseek({"message": "What affects Dover-Calais?"}, context)
        self.assertEqual(status, 200)
        self.assertEqual([item["evidence_id"] for item in response["evidence"]], ["e1"])

    def test_action_record_contains_transition_and_trace(self):
        record = action_record(
            item_id="42", action="correct", current_status="pending_human_review",
            actor_id="admin-1", rationale="Add missing citation", correction="Use source e7",
            graph_run_id="run-1", trace_id="trace-1", idempotency_key="idem-1",
        )
        self.assertEqual(record["previous_status"], "pending_human_review")
        self.assertEqual(record["next_status"], "corrected")
        self.assertEqual(record["graph_run_id"], "run-1")
        self.assertEqual(record["correction"], "Use source e7")

    def test_graph_payload_preserves_run_and_trace_references(self):
        payload = review_item_payload_for_graph(
            graph_name="conversation", graph_run_id="run-1", trace_id="trace-1",
            title="Fare recommendation", reason="High-impact recommendation",
            recommendation="Change fare policy", evidence_ids=["e1"], route_key="all",
        )
        self.assertEqual(payload["status"], "pending_human_review")
        self.assertEqual(payload["metadata"]["graph_run_id"], "run-1")
        self.assertEqual(payload["metadata"]["trace_id"], "trace-1")


if __name__ == "__main__":
    unittest.main()

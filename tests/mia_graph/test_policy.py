import unittest

from backend.mia_graph.contracts import ConversationInput
from backend.mia_graph.policy import decide_review


class PolicyTests(unittest.TestCase):
    def test_conversation_input_rejects_raw_upload_rows(self):
        with self.assertRaisesRegex(ValueError, "raw upload rows"):
            ConversationInput(
                message="Summarise",
                actor_id="u1",
                upload_context={"rows": [{"email": "a@example.com"}]},
            )

    def test_review_policy_queues_missing_citations_and_price_actions(self):
        decision = decide_review(
            {"confidence": 0.98, "evidence_ids": [], "recommendation": "Change fare policy"}
        )
        self.assertTrue(decision.requires_human_review)
        self.assertEqual(
            decision.reasons, ["missing_citations", "high_impact_recommendation"]
        )


if __name__ == "__main__":
    unittest.main()

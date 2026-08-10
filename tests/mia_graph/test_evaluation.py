import unittest

from backend.mia_graph.evaluation import build_evaluation_graph, build_evaluation_run, promotion_decision


class EvaluationGraphTests(unittest.TestCase):
    def test_evaluation_graph_blocks_a_regressed_candidate(self):
        graph = build_evaluation_graph()
        state = graph.invoke({
            "cases": [{"question": "Q", "expected_answer": "secret", "expected_evidence_ids": ["e1"]}],
            "current_metrics": {"recall_at_5": 0.82, "citation_correctness": 0.96},
            "baseline_metrics": {"recall_at_5": 0.90, "citation_correctness": 0.95},
        })
        self.assertEqual(state["promotion_state"], "blocked")
        self.assertNotIn("expected_answer", state["live_retrieval_payload"])
        self.assertEqual(state["workflow_steps"][-1], "block_promotion")

    def test_regressed_recall_blocks_promotion(self):
        result = promotion_decision(
            {"recall_at_5": 0.82, "citation_correctness": 0.96},
            {"recall_at_5": 0.90, "citation_correctness": 0.95},
        )
        self.assertEqual(result["promotion_state"], "blocked")
        self.assertIn("recall_at_5_regression", result["reasons"])

    def test_heldout_expected_answers_never_reach_live_retrieval(self):
        run = build_evaluation_run([
            {"question": "Q", "expected_answer": "secret", "expected_evidence_ids": ["e1"]}
        ])
        self.assertNotIn("expected_answer", run["live_retrieval_payload"])
        self.assertNotIn("expected_evidence_ids", run["live_retrieval_payload"])


if __name__ == "__main__":
    unittest.main()

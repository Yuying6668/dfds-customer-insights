import unittest

from backend.mia_graph.dataset import build_dataset_graph, run_dataset_graph


SAFE_SNAPSHOT = {
    "batchId": "batch-1",
    "analysisVersion": "analysis-v1",
    "metrics": {"rating": {"average": 2.8, "sampleSize": 12}},
    "recommendations": [{"type": "review_low_rating_drivers"}],
}


class DatasetGraphTests(unittest.TestCase):
    def test_dataset_graph_executes_fixed_aggregate_only_workflow(self):
        graph = build_dataset_graph()
        state = graph.invoke({"snapshot": SAFE_SNAPSHOT, "run_id": "run-graph", "graph_version": "mia-graph-v1", "evidence_ids": ["e1"]})
        self.assertEqual(state["publication_state"], "published_snapshot")
        self.assertEqual(state["workflow_steps"], ["load_approved_run", "build_safe_aggregates", "retrieve_comparative_evidence", "analyse_patterns", "draft_recommendations", "validate_publication", "publish_snapshot"])

    def test_dataset_graph_reuses_snapshot_for_identical_run(self):
        first = run_dataset_graph(SAFE_SNAPSHOT, run_id="run-1", graph_version="mia-graph-v1", evidence_ids=["e1"])
        second = run_dataset_graph(SAFE_SNAPSHOT, run_id="run-1", graph_version="mia-graph-v1", evidence_ids=["e1"])
        self.assertEqual(first["idempotency_key"], second["idempotency_key"])
        self.assertFalse(second["created_new_snapshot"])

    def test_dataset_graph_holds_uncited_recommendation(self):
        state = run_dataset_graph(SAFE_SNAPSHOT, run_id="run-2", graph_version="mia-graph-v1", evidence_ids=[])
        self.assertEqual(state["publication_state"], "pending_human_review")


if __name__ == "__main__":
    unittest.main()

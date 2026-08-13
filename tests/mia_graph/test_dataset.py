import unittest

from backend.mia_graph.dataset import build_dataset_graph, dataset_idempotency_key, run_dataset_graph


SAFE_SNAPSHOT = {
    "batchId": "batch-1",
    "analysisVersion": "analysis-v1",
    "metrics": {"rating": {"average": 2.8, "sampleSize": 12}},
    "recommendations": [{"type": "review_low_rating_drivers", "owner": "CX", "expectedImpact": "Reduce repeat complaints", "limitations": ["Small sample"], "confidence": 0.82}],
}

EXTERNAL_EVIDENCE = [{
    "id": "e1",
    "sourceType": "trustpilot",
    "title": "Route reliability signal",
    "excerpt": "Customers mention disruption updates.",
    "collectedAt": "2026-08-01T00:00:00Z",
    "reliability": "directional",
    "coverage": "public reviews",
}]


class DatasetGraphTests(unittest.TestCase):
    def test_dataset_graph_rejects_raw_rows_before_checkpointing(self):
        with self.assertRaises(ValueError):
            run_dataset_graph({**SAFE_SNAPSHOT, "rows": [{"email": "person@example.test"}]}, run_id="raw", graph_version="mia-graph-v1")
    def test_dataset_state_declares_recoverable_failure_contract(self):
        state = build_dataset_graph().invoke({"snapshot": SAFE_SNAPSHOT, "run_id": "failure-contract", "graph_version": "mia-graph-v1", "evidence_ids": EXTERNAL_EVIDENCE})
        self.assertIn("failure_state", state)
        self.assertIn("last_safe_state", state)
        self.assertIn("retry", state)
    def test_dataset_graph_executes_fixed_aggregate_only_workflow(self):
        graph = build_dataset_graph()
        state = graph.invoke({"snapshot": SAFE_SNAPSHOT, "run_id": "run-graph", "graph_version": "mia-graph-v1", "evidence_ids": EXTERNAL_EVIDENCE})
        self.assertEqual(state["publication_state"], "pending_human_review")
        self.assertEqual(state["workflow_steps"][-1], "queue_review")

    def test_dataset_graph_normalizes_external_evidence_and_recommendation_contract(self):
        state = build_dataset_graph().invoke({"snapshot": SAFE_SNAPSHOT, "run_id": "run-contract", "graph_version": "mia-graph-v1", "evidence_ids": EXTERNAL_EVIDENCE})
        evidence = state["comparative_evidence"][0]
        recommendation = state["recommendations"][0]
        self.assertEqual(evidence["sourceType"], "trustpilot")
        self.assertEqual(evidence["coverage"], "public reviews")
        for key in ("owner", "expectedImpact", "limitations", "confidence", "evidenceIds"):
            self.assertIn(key, recommendation)

    def test_approved_review_publishes_snapshot(self):
        state = build_dataset_graph().invoke({
            "snapshot": SAFE_SNAPSHOT,
            "run_id": "run-approved",
            "graph_version": "mia-graph-v1",
            "evidence_ids": EXTERNAL_EVIDENCE,
            "review_decision": {"status": "approved", "reviewerId": "reviewer-1", "reason": "Evidence checked"},
        })
        self.assertEqual(state["publication_state"], "published_snapshot")
        self.assertEqual(state["review"]["reviewerId"], "reviewer-1")

    def test_dataset_graph_reuses_snapshot_for_identical_run(self):
        first = run_dataset_graph(SAFE_SNAPSHOT, run_id="run-1", graph_version="mia-graph-v1", evidence_ids=EXTERNAL_EVIDENCE)
        second = run_dataset_graph(SAFE_SNAPSHOT, run_id="run-1", graph_version="mia-graph-v1", evidence_ids=EXTERNAL_EVIDENCE)
        self.assertEqual(first["idempotency_key"], second["idempotency_key"])
        self.assertFalse(second["created_new_snapshot"])

    def test_dataset_graph_holds_uncited_recommendation(self):
        state = run_dataset_graph(SAFE_SNAPSHOT, run_id="run-2", graph_version="mia-graph-v1", evidence_ids=[])
        self.assertEqual(state["publication_state"], "pending_human_review")

    def test_retry_creates_new_attempt(self):
        first = run_dataset_graph(SAFE_SNAPSHOT, run_id="run-retry", graph_version="mia-graph-v1", evidence_ids=EXTERNAL_EVIDENCE)
        retry = run_dataset_graph(SAFE_SNAPSHOT, run_id="run-retry", graph_version="mia-graph-v1", evidence_ids=EXTERNAL_EVIDENCE, retry=True)
        self.assertEqual(first["idempotency_key"], retry["idempotency_key"])
        self.assertEqual(retry["attempt"], first["attempt"] + 1)
        self.assertTrue(first["created_new_snapshot"])

    def test_dataset_run_preserves_trace_id_for_audit_linkage(self):
        result = run_dataset_graph(
            SAFE_SNAPSHOT,
            run_id="run-trace",
            graph_version="mia-graph-v1",
            evidence_ids=EXTERNAL_EVIDENCE,
            trace_id="trace-dataset-1",
            retry=True,
        )
        self.assertEqual(result["trace_id"], "trace-dataset-1")

    def test_persisted_snapshot_is_idempotent_after_process_restart(self):
        key = dataset_idempotency_key("run-persisted", "analysis-v1", "mia-graph-v1")
        persisted = {**SAFE_SNAPSHOT, "idempotency_key": key, "attempt": 3, "publication_state": "pending_human_review"}
        result = run_dataset_graph(persisted, run_id="run-persisted", graph_version="mia-graph-v1", evidence_ids=EXTERNAL_EVIDENCE)
        self.assertFalse(result["created_new_snapshot"])
        self.assertEqual(result["attempt"], 3)


if __name__ == "__main__":
    unittest.main()

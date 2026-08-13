import json
import tempfile
import unittest
from pathlib import Path

from scripts.run_mia_demo import run_demo


class DeliveryDemoTests(unittest.TestCase):
    def test_demo_reproduces_the_required_evidence_chain(self):
        with tempfile.TemporaryDirectory() as directory:
            report = run_demo(Path(directory))

        self.assertEqual(report["schemaVersion"], "mia-demo-v1")
        self.assertEqual(
            report["evidenceChain"],
            ["internal_batch", "external_evidence", "cited_answer", "insight_draft", "conditional_review", "evaluation_run"],
        )
        self.assertTrue(report["internalBatch"]["published"])
        self.assertEqual(report["answer"]["citations"], ["external-001"])
        self.assertEqual(report["insightDraft"]["publication_state"], "pending_human_review")
        self.assertEqual(report["graphExecution"], ["dataset", "conversation", "evaluation"])
        self.assertEqual(len({report["traces"][name] for name in ("dataset", "conversation", "evaluation")}), 1)
        self.assertIn("human_review", report["evaluation"])
        for name in ("dataset", "conversation", "evaluation"):
            self.assertEqual(report["traceRecords"][name]["trace_id"], report["traces"][name])
            self.assertEqual(report["traceRecords"][name]["graph_version"], "mia-graph-v1")
        self.assertEqual(report["review"]["beforeApproval"], "pending_human_review")
        self.assertEqual(report["review"]["afterApproval"], "published_snapshot")
        self.assertEqual(report["evaluation"]["metrics"]["cases"], 5)
        self.assertTrue({"recall_at_5", "citation_correctness", "answer_quality", "abstention_accuracy", "p95_latency_ms", "failure_rate"}.issubset(report["evaluation"]["metrics"]))
        self.assertTrue(report["evaluation"]["segments"])

    def test_demo_is_deterministic_and_writes_json_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            first = run_demo(output)
            second = run_demo(output)
            persisted = json.loads((output / "mia-demo-report.json").read_text(encoding="utf-8"))

        self.assertEqual(first["runId"], second["runId"])
        self.assertEqual(first["insightDraft"]["idempotency_key"], second["insightDraft"]["idempotency_key"])
        self.assertEqual(persisted["runId"], first["runId"])


if __name__ == "__main__":
    unittest.main()

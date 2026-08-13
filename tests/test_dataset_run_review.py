import json
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

import server
from backend.mia_graph.dataset import run_dataset_graph


class DatasetRunReviewApiTests(unittest.TestCase):
    def test_simulated_public_evidence_to_approved_snapshot_flow(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_id = str(uuid.uuid4())
            batch_dir = root / batch_id
            batch_dir.mkdir()
            base_snapshot = {
                "batchId": batch_id,
                "analysisVersion": "analysis-v1",
                "generatedAt": "2026-08-10T00:00:00Z",
                "metrics": {"rating": {"average": 2.8, "sampleSize": 12}},
                "distributions": {"route": {"dover-calais": 12}},
                "recommendations": [{"type": "review_low_rating_drivers"}],
            }
            retrieval = {"items": [{"id": "public-1", "source": "Trustpilot", "title": "Disruption updates", "body": "Customers report delayed updates.", "timestamp": "2026-08-01", "route": "Dover-Calais", "sourceTier": "public_snapshot", "isSynthetic": False}]}
            with patch.object(server, "retrieve_evidence_from_db", return_value=retrieval):
                evidence = server.retrieve_dataset_comparative_evidence(base_snapshot)
            draft = run_dataset_graph(base_snapshot, run_id=f"run-{batch_id}", graph_version="mia-graph-v1", evidence_ids=evidence)
            self.assertEqual(draft["publication_state"], "pending_human_review")
            self.assertEqual(draft["comparativeEvidence"][0]["sourceType"], "Trustpilot")
            self.assertIn("owner", draft["recommendations"][0])

            manifest = {"batch": {"id": batch_id, "ownerId": "user-1", "sourceType": "it_data", "datasetRun": {"state": "published", "publishedAt": f"run-{batch_id}", "analysisState": "ready"}}}
            (batch_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            (batch_dir / "analytics.json").write_text(json.dumps(draft), encoding="utf-8")
            with patch.object(server, "UPLOAD_STORAGE_DIR", root):
                status, result = server.review_dataset_run(batch_id, {"id": "user-1"}, {"status": "approved", "reviewerId": "reviewer-1", "reason": "Public evidence and limitations checked"})

            self.assertEqual(status, 200)
            self.assertEqual(result["snapshot"]["publication_state"], "published_snapshot")
            self.assertEqual(result["snapshot"]["attempt"], 2)
            saved_manifest = json.loads((batch_dir / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(saved_manifest["batch"]["datasetRun"]["reviewState"], "approved")

    def test_retrieves_only_public_comparative_evidence_for_dataset_metrics(self):
        retrieval = {
            "items": [
                {"id": "public-1", "source": "Trustpilot", "title": "Delay updates", "body": "Customers mention disruption messages.", "timestamp": "2026-08-01", "sourceTier": "public_snapshot", "isSynthetic": False, "route": "Dover-Calais"},
                {"id": "demo-1", "source": "Synthetic", "title": "Demo only", "body": "Ignore", "sourceTier": "synthetic_demo", "isSynthetic": True},
            ]
        }
        with patch.object(server, "retrieve_evidence_from_db", return_value=retrieval) as retrieve:
            evidence = server.retrieve_dataset_comparative_evidence({"metrics": {"rating": {"average": 2.8}}, "distributions": {"route": {"dover-calais": 12}}})

        self.assertEqual([item["id"] for item in evidence], ["public-1"])
        self.assertEqual(evidence[0]["sourceType"], "Trustpilot")
        self.assertEqual(evidence[0]["coverage"], "Dover-Calais")
        self.assertIn("rating", retrieve.call_args.args[0]["message"])

    def test_approved_review_publishes_the_existing_dataset_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_id = "00000000-0000-0000-0000-000000000101"
            batch_dir = root / batch_id
            batch_dir.mkdir()
            manifest = {
                "batch": {
                    "id": batch_id,
                    "ownerId": "user-1",
                    "sourceType": "it_data",
                    "datasetRun": {"state": "published", "publishedAt": "2026-08-10T00:00:00Z", "analysisState": "ready"},
                }
            }
            snapshot = {
                "analysisVersion": "analysis-v1",
                "graphVersion": "mia-graph-v1",
                "evidence_ids": [{"id": "external-1", "sourceType": "trustpilot"}],
                "recommendations": [{"type": "improve_updates"}],
            }
            (batch_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            (batch_dir / "analytics.json").write_text(json.dumps(snapshot), encoding="utf-8")

            with patch.object(server, "UPLOAD_STORAGE_DIR", root):
                status, result = server.review_dataset_run(batch_id, {"id": "user-1"}, {"status": "approved", "reviewerId": "reviewer-1"})

            self.assertEqual(status, 200)
            self.assertEqual(result["snapshot"]["publication_state"], "published_snapshot")
            persisted = json.loads((batch_dir / "analytics.json").read_text(encoding="utf-8"))
            self.assertEqual(persisted["review"]["reviewerId"], "reviewer-1")
            self.assertTrue(persisted["review"]["reviewedAt"].endswith("Z"))

    def test_non_approved_review_stays_pending(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            batch_id = "00000000-0000-0000-0000-000000000102"
            batch_dir = root / batch_id
            batch_dir.mkdir()
            (batch_dir / "manifest.json").write_text(json.dumps({"batch": {"id": batch_id, "ownerId": "user-1", "datasetRun": {"state": "published", "publishedAt": "2026-08-10T00:00:00Z"}}}), encoding="utf-8")
            (batch_dir / "analytics.json").write_text(json.dumps({"analysisVersion": "analysis-v1", "graphVersion": "mia-graph-v1", "evidence_ids": [{"id": "external-2"}], "recommendations": []}), encoding="utf-8")

            with patch.object(server, "UPLOAD_STORAGE_DIR", root):
                status, result = server.review_dataset_run(batch_id, {"id": "user-1"}, {"status": "reanalyse", "reviewerId": "reviewer-1"})

            self.assertEqual(status, 200)
            self.assertEqual(result["snapshot"]["publication_state"], "pending_human_review")


if __name__ == "__main__":
    unittest.main()

import json
import tempfile
import unittest
from pathlib import Path

from backend.deletion_propagation import BatchDeletedError, assert_batch_active, build_deletion_plan, is_batch_deleted, propagate_batch_deletion, register_lineage


class DeletionPropagationTests(unittest.TestCase):
    def test_deletion_plan_covers_every_derived_layer(self):
        with tempfile.TemporaryDirectory() as directory:
            plan = build_deletion_plan("batch-123", Path(directory))
            self.assertEqual([item.layer for item in plan], [
                "raw_files", "cleaned_data", "evidence", "embeddings",
                "retrieval_cache", "analysis_snapshot", "langfuse_trace", "audit_trace",
            ])

    def test_propagation_removes_batch_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            tmp_path = Path(directory)
            batch_dir = tmp_path / "batch-123"
            batch_dir.mkdir()
            (batch_dir / "manifest.json").write_text(json.dumps({"batch": {"id": "batch-123"}}))
            (batch_dir / "cleaned.json").write_text("cleaned")
            (batch_dir / "analytics.json").write_text("snapshot")

            first = propagate_batch_deletion("batch-123", tmp_path, actor_id="admin-1", reason="GDPR request")
            second = propagate_batch_deletion("batch-123", tmp_path, actor_id="admin-1", reason="GDPR request")

            self.assertEqual(first.status, "completed")
            self.assertEqual(second.status, "completed")
            self.assertFalse(batch_dir.exists())
            self.assertTrue(is_batch_deleted("batch-123", tmp_path))
            with self.assertRaises(BatchDeletedError):
                assert_batch_active("batch-123", tmp_path)
            tombstone = json.loads((tmp_path / ".tombstones" / "batch-123.json").read_text())
            self.assertNotIn("GDPR request", tombstone.values())
            self.assertIn("reasonHash", tombstone)

    def test_lineage_rejects_unknown_deletion_layers(self):
        with self.assertRaises(ValueError):
            register_lineage(None, batch_id="batch-123", layer="unclassified", subject_type="record", subject_id="1")

    def test_external_trace_failure_leaves_tombstone_incomplete_for_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "batch-123").mkdir()
            with self.assertRaises(RuntimeError):
                propagate_batch_deletion(
                    "batch-123", root, actor_id="admin-1", reason="GDPR request",
                    trace_sink=lambda _: (_ for _ in ()).throw(RuntimeError("provider unavailable")),
                )
            self.assertFalse(is_batch_deleted("batch-123", root))


if __name__ == "__main__":
    unittest.main()

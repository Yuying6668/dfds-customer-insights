import unittest

from backend.mia_graph.triggers import MiaTriggerScheduler, on_component_version_change, on_external_refresh_complete


class TriggerTests(unittest.TestCase):
    def test_completed_external_refresh_runs_dataset_graph(self):
        calls = []
        result = on_external_refresh_complete({"status": "completed", "batch_id": "b1", "snapshot": {"analysisVersion": "a1"}}, lambda **kwargs: calls.append(kwargs) or {"idempotency_key": "k"})
        self.assertTrue(result["triggered"])
        self.assertEqual(calls[0]["run_id"], "b1")

    def test_component_version_change_runs_evaluation_graph(self):
        calls = []
        result = on_component_version_change({"component": "prompt", "version": "p2", "cases": [{"question": "Q"}]}, lambda **kwargs: calls.append(kwargs) or {"promotion_state": "blocked"})
        self.assertTrue(result["triggered"])
        self.assertEqual(calls[0]["graph_version"], "mia-graph-v1")

    def test_scheduler_deduplicates_a_seen_component_version(self):
        calls = []
        scheduler = MiaTriggerScheduler(run_dataset=lambda **_: {}, run_evaluation=lambda **kwargs: calls.append(kwargs) or {})
        event = {"component": "prompt", "version": "p2", "cases": [{"question": "Q"}]}
        self.assertTrue(scheduler.poll_version_change(event)["triggered"])
        self.assertFalse(scheduler.poll_version_change(event)["triggered"])
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()

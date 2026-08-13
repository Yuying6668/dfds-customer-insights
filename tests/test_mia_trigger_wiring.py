import unittest
from unittest.mock import patch

import server


class MiaTriggerWiringTests(unittest.TestCase):
    def setUp(self):
        server.MIA_TRIGGER_SCHEDULER = None

    def test_external_refresh_event_dispatches_dataset_graph(self):
        with patch.object(server, "run_dataset_graph", return_value={"idempotency_key": "dataset-key"}) as run:
            result = server.process_external_refresh_event({"status": "completed", "batch_id": "external-run", "snapshot": {"analysisVersion": "v1"}})
        self.assertTrue(result["triggered"])
        self.assertEqual(run.call_args.kwargs["run_id"], "external-run")

    def test_version_change_event_dispatches_frozen_evaluation(self):
        with patch.object(server, "run_frozen_evaluation", return_value={"promotionState": "accepted"}) as run:
            result = server.process_component_version_event({"component": "prompt", "version": "p2", "evaluationSetId": "set-1"})
        self.assertTrue(result["triggered"])
        self.assertEqual(run.call_args.args[0], "set-1")


if __name__ == "__main__":
    unittest.main()

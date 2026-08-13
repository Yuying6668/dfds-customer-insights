import unittest

from backend.mia_graph.checkpoint import build_checkpointer, checkpoint_session
from backend.mia_graph.dataset import build_dataset_graph
from backend.mia_graph.evaluation import build_evaluation_graph


class CheckpointTests(unittest.TestCase):
    def test_checkpoint_session_yields_a_usable_memory_saver(self):
        with checkpoint_session(testing=True) as checkpointer:
            self.assertIsNotNone(checkpointer)
            self.assertTrue(hasattr(checkpointer, "get_tuple"))

    def test_dataset_and_evaluation_graphs_accept_memory_checkpoints(self):
        checkpointer = build_checkpointer(testing=True)
        dataset_state = build_dataset_graph(checkpointer=checkpointer).invoke(
            {"snapshot": {"analysisVersion": "v1"}, "run_id": "checkpoint-run", "graph_version": "v1", "evidence_ids": ["e1"], "review_decision": {"status": "approved", "reviewerId": "reviewer-1"}},
            config={"configurable": {"thread_id": "dataset-checkpoint"}},
        )
        evaluation_state = build_evaluation_graph(checkpointer=checkpointer).invoke(
            {"cases": [], "current_metrics": {"recall_at_5": 0.9, "citation_correctness": 0.95}, "baseline_metrics": {"recall_at_5": 0.9, "citation_correctness": 0.95}},
            config={"configurable": {"thread_id": "evaluation-checkpoint"}},
        )
        self.assertEqual(dataset_state["publication_state"], "published_snapshot")
        self.assertEqual(evaluation_state["promotion_state"], "accepted")


if __name__ == "__main__":
    unittest.main()

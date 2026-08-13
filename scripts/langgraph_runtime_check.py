#!/usr/bin/env python3
"""Verify all Mia graphs against the configured PostgreSQL checkpoint store."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.mia_graph.checkpoint import checkpoint_session
from backend.mia_graph.conversation import build_conversation_graph
from backend.mia_graph.dataset import run_dataset_graph
from backend.mia_graph.evaluation import build_evaluation_graph, build_evaluation_run


class ConversationServices:
    def route_request(self, state):
        return {"route": "evidence_qa"}

    def retrieve_evidence(self, state):
        return {"evidence_ids": ["runtime-e1"], "rag_context": {"retrieval": {"layers": []}}}

    def generate_answer(self, state):
        return {"answer": {"text": "runtime verification", "evidence_ids": ["runtime-e1"], "confidence": 0.95}}

    def validate_draft(self, state):
        return {}

    def queue_review(self, state):
        return {"publication_state": "pending_human_review"}


class EvaluationServices:
    def retrieve_case(self, case):
        return {"retrieved_evidence_ids": ["runtime-e1"], "latency_ms": 1}

    def answer_case(self, case, retrieval):
        return {"citation_correct": True, "judge_score": 1.0, "latency_ms": 1}

    def judge_case(self, result, labels):
        return {"citation_correct": True, "judge_score": 1.0, "judge_rubric_version": "runtime-v1"}


def main() -> int:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped and not stripped.startswith("#") and "=" in stripped:
                key, value = stripped.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    if not os.environ.get("LANGGRAPH_CHECKPOINT_DATABASE_URL"):
        print(json.dumps({"status": "blocked", "reason": "LANGGRAPH_CHECKPOINT_DATABASE_URL is not configured"}))
        return 2
    try:
        with checkpoint_session() as saver:
            conversation = build_conversation_graph(ConversationServices(), checkpointer=saver)
            conversation_config = {"configurable": {"thread_id": "runtime-check:conversation"}}
            conversation.invoke({"message": "runtime check", "actor_id": "runtime", "trace_id": "runtime-conversation"}, config=conversation_config)
            if saver.get_tuple(conversation_config) is None:
                raise RuntimeError("conversation checkpoint was not persisted")

            dataset = run_dataset_graph(
                {"analysisVersion": "runtime-v1", "metrics": {}, "distributions": {}, "insights": [], "recommendations": []},
                run_id="runtime-check-dataset", graph_version="mia-graph-v1", evidence_ids=["runtime-e1"], checkpointer=saver,
            )
            dataset_config = {"configurable": {"thread_id": f"dataset:{dataset['idempotency_key']}"}}
            if saver.get_tuple(dataset_config) is None:
                raise RuntimeError("dataset checkpoint was not persisted")

            prepared_evaluation = build_evaluation_run([{"question": "runtime", "language": "en", "route": "all", "source_type": "internal", "expected_evidence_ids": ["runtime-e1"], "expects_abstention": False}])
            evaluation = build_evaluation_graph(checkpointer=saver, services=EvaluationServices(), label_vault=prepared_evaluation["label_vault"])
            evaluation_config = {"configurable": {"thread_id": "runtime-check:evaluation"}}
            evaluation.invoke({"cases": prepared_evaluation["live_retrieval_payload"]["cases"], "baseline_metrics": {"recall_at_5": 1.0, "citation_correctness": 1.0, "answer_quality": 1.0, "abstention_accuracy": 1.0, "p95_latency_ms": 5000.0, "failure_rate": 0.0}}, config=evaluation_config)
            if saver.get_tuple(evaluation_config) is None:
                raise RuntimeError("evaluation checkpoint was not persisted")
        print(json.dumps({"status": "ready", "graphs": ["conversation", "dataset", "evaluation"], "checkpoint": "postgresql"}))
        return 0
    except Exception as exc:
        print(json.dumps({"status": "blocked", "error": str(exc)}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

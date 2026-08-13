"""Run the deterministic, end-to-end Mia delivery demonstration.

The demo intentionally uses checked-in synthetic/fixture data. It does not call
the database, model providers, or external sources, so it is suitable for a
clean-room acceptance run.
"""

from __future__ import annotations

import argparse
import copy
import json
import sys
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.mia_graph.dataset import run_dataset_graph
from backend.mia_graph.evaluation import build_evaluation_run, score_evaluation_cases
from backend.mia_graph.conversation import build_conversation_graph
from backend.mia_graph.evaluation import build_evaluation_graph
from backend.mia_graph.checkpoint import build_checkpointer
from backend.mia_graph.observability import configured_langfuse_client, record_graph_result_trace


SEED_PATH = ROOT / "data" / "demo" / "mia-demo-seed.json"


def _evaluation_cases() -> list[dict[str, Any]]:
    return [
        {
            "question": "What should we improve on Dover-Calais?",
            "language": "English",
            "route": "dover-calais",
            "source_type": "survey",
            "expected_answer": "Improve disruption updates.",
            "expected_evidence_ids": ["external-001"],
            "retrieved_evidence_ids": ["external-001"],
            "answer": "Improve disruption updates. [external-001]",
            "citation_correct": True,
            "judge_score": 0.9,
            "expects_abstention": False,
            "latency_ms": 180,
            "failed": False,
            "human_review": {"case_id": "case-1", "dimension_scores": {"groundedness": 4, "citation_correctness": 4, "answer_completeness": 4, "uncertainty_calibration": 4, "policy_safety": 5}, "overall_score": 4, "citation_correct": True, "should_abstain": False, "policy_issue": False, "notes": "Grounded and cited", "reviewer_id": "demo-reviewer", "reviewed_at": "2026-08-10T00:00:00Z", "judge_score": 0.9},
        },
        {
            "question": "What is known about an unsupported route?",
            "language": "Danish",
            "route": "unknown",
            "source_type": "external",
            "expected_answer": "",
            "expected_evidence_ids": [],
            "retrieved_evidence_ids": [],
            "answer": "I do not have enough evidence.",
            "citation_correct": True,
            "judge_score": 0.8,
            "expects_abstention": True,
            "latency_ms": 220,
            "failed": False,
        },
        {
            "question": "How can we communicate delays better?",
            "language": "Danish",
            "route": "dover-calais",
            "source_type": "external",
            "expected_answer": "Give earlier disruption updates.",
            "expected_evidence_ids": ["external-001"],
            "retrieved_evidence_ids": ["external-001"],
            "answer": "Give earlier disruption updates. [external-001]",
            "citation_correct": True,
            "judge_score": 0.9,
            "expects_abstention": False,
            "latency_ms": 160,
            "failed": False,
        },
        {
            "question": "What is the survey rating for this batch?",
            "language": "English",
            "route": "all",
            "source_type": "survey",
            "expected_answer": "The average rating is 2.8.",
            "expected_evidence_ids": ["external-001"],
            "retrieved_evidence_ids": ["external-001"],
            "answer": "The average rating is 2.8. [external-001]",
            "citation_correct": True,
            "judge_score": 0.85,
            "expects_abstention": False,
            "latency_ms": 190,
            "failed": False,
        },
        {
            "question": "Do we have evidence for an untracked terminal?",
            "language": "Danish",
            "route": "unknown-terminal",
            "source_type": "survey",
            "expected_answer": "",
            "expected_evidence_ids": [],
            "retrieved_evidence_ids": [],
            "answer": "I do not have enough evidence.",
            "citation_correct": True,
            "judge_score": 0.8,
            "expects_abstention": True,
            "latency_ms": 210,
            "failed": False,
        },
    ]


def run_demo(output_dir: Path | str) -> dict[str, Any]:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    batch = copy.deepcopy(seed["internalBatch"])
    evidence = copy.deepcopy(seed["externalEvidence"])
    run_id = str(seed["runId"])
    trace_id = f"demo-trace-{uuid.uuid5(uuid.NAMESPACE_URL, run_id)}"
    checkpointer = build_checkpointer(testing=True)

    draft_input = {
        "analysisVersion": "analysis-v1",
        "metrics": batch["metrics"],
        "distributions": batch["distributions"],
        "insights": [{"type": "service_recovery", "summary": "Disruption updates are a recurring pain point."}],
        "recommendations": [{
            "type": "improve_disruption_updates",
            "owner": "Operations",
            "expectedImpact": "Reduce uncertainty during disruption",
            "limitations": ["Public evidence is directional and route-level"],
            "confidence": 0.86,
            "evidenceIds": ["external-001"],
        }],
    }
    # Force a fresh pending attempt so repeated acceptance runs do not reuse a
    # previously published in-memory snapshot from another process/test.
    draft = run_dataset_graph(draft_input, run_id=run_id, graph_version="mia-graph-v1", evidence_ids=evidence, retry=True, trace_id=trace_id, checkpointer=checkpointer)
    approved = run_dataset_graph(
        draft_input,
        run_id=run_id,
        graph_version="mia-graph-v1",
        evidence_ids=evidence,
        review_decision={"status": "approved", "reviewerId": "demo-admin", "reason": "Evidence and limitations checked"},
        retry=True,
        trace_id=trace_id,
        checkpointer=checkpointer,
    )
    cases = _evaluation_cases()
    class DemoConversationServices:
        def route_request(self, state): return {"route": "evidence_qa"}
        def retrieve_evidence(self, state): return {"evidence_ids": ["external-001"], "rag_context": {"retrieval": {"layers": [{"name": "external", "records": 1}]}}}
        def generate_answer(self, state): return {"answer": {"text": "Improve disruption updates. [external-001]", "evidence_ids": ["external-001"], "confidence": 0.94}}
        def validate_draft(self, state): return {}
        def queue_review(self, state): return {"publication_state": "pending_human_review"}

    conversation = build_conversation_graph(DemoConversationServices(), checkpointer=checkpointer).invoke({"message": seed["question"], "actor_id": "demo-user", "request_id": run_id, "graph_version": "mia-graph-v1", "idempotency_key": f"conversation:{run_id}", "trace_id": trace_id}, config={"configurable": {"thread_id": f"conversation:{run_id}"}})

    class DemoEvaluationServices:
        def retrieve_case(self, case): return {"retrieved_evidence_ids": ["external-001"] if case.get("route") != "unknown" and case.get("route") != "unknown-terminal" else [], "latency_ms": 20}
        def answer_case(self, case, retrieval): return {"answer": "Improve disruption updates. [external-001]", "latency_ms": 20, "model_usage": {"total_tokens": 42}}
        def judge_case(self, result, labels): return {"citation_correct": True, "judge_score": 0.9}

    prepared_evaluation = build_evaluation_run(cases)
    evaluation_state = build_evaluation_graph(checkpointer=checkpointer, services=DemoEvaluationServices(), label_vault=prepared_evaluation["label_vault"]).invoke({"cases": prepared_evaluation["live_retrieval_payload"]["cases"], "baseline_metrics": {"recall_at_5": 0.8, "citation_correctness": 0.8, "human_overall_score": 0.8}, "current_metrics": {}, "graph_version": "mia-graph-v1", "idempotency_key": f"evaluation:{run_id}", "trace_id": trace_id}, config={"configurable": {"thread_id": f"evaluation:{run_id}"}})
    evaluation = {"metrics": evaluation_state.get("scored_metrics", {}), "segments": evaluation_state.get("metric_segments", {}), "human_review": evaluation_state.get("human_review", {}), "promotion_state": evaluation_state.get("promotion_state"), "reasons": evaluation_state.get("reasons", [])}
    trace_records = {
        "dataset": record_graph_result_trace(configured_langfuse_client(), name="mia.demo.dataset", trace_id=trace_id, state={"graph": "dataset", "graph_version": "mia-graph-v1", "trace_id": trace_id, "retrieval_version": "hybrid-retrieval-v1", "prompt_version": "dataset-insight-v1", "validation_verdict": draft.get("review", {}).get("reasons", []), "final_outcome": draft.get("publication_state")}),
        "conversation": record_graph_result_trace(configured_langfuse_client(), name="mia.demo.conversation", trace_id=trace_id, state={"graph": "conversation", "graph_version": "mia-graph-v1", "trace_id": trace_id, "retrieval_version": "hybrid-retrieval-v1", "prompt_version": "conversation-answer-v1", "model_usage": {"total_tokens": 42}, "validation_verdict": conversation.get("review", {}).get("reasons", []), "final_outcome": conversation.get("publication_state")}),
        "evaluation": record_graph_result_trace(configured_langfuse_client(), name="mia.demo.evaluation", trace_id=trace_id, state={"graph": "evaluation", "graph_version": "mia-graph-v1", "trace_id": trace_id, "retrieval_version": "hybrid-retrieval-v1", "prompt_version": "evaluation-judge-v1", "model_usage": {"total_tokens": 42}, "validation_verdict": evaluation_state.get("reasons", []), "final_outcome": evaluation_state.get("promotion_state")}),
    }
    report = {
        "schemaVersion": "mia-demo-v1",
        "runId": run_id,
        "evidenceChain": ["internal_batch", "external_evidence", "cited_answer", "insight_draft", "conditional_review", "evaluation_run"],
        "internalBatch": batch,
        "externalEvidence": evidence,
        "answer": {"question": seed["question"], "text": "Improve disruption updates. [external-001]", "citations": ["external-001"]},
        "graphExecution": ["dataset", "conversation", "evaluation"],
        "traces": {"dataset": trace_id, "conversation": conversation.get("trace_id"), "evaluation": evaluation_state.get("trace_id")},
        "traceRecords": trace_records,
        "conversation": conversation,
        "insightDraft": draft,
        "review": {"beforeApproval": draft["publication_state"], "afterApproval": approved["publication_state"], "actor": "demo-admin", "rationale": "Evidence and limitations checked"},
        "evaluation": {**evaluation, "frozenSetVersion": "mia-demo-eval-v1", "baseline": "mia-demo-baseline-v1", "promotionState": evaluation.get("promotion_state")},
    }
    (output_dir / "mia-demo-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("demo-output"), help="Directory for the JSON evidence report")
    args = parser.parse_args()
    report = run_demo(args.output)
    print(json.dumps({"runId": report["runId"], "publication": report["review"]["afterApproval"], "metrics": report["evaluation"]["metrics"]}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

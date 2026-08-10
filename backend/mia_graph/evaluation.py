"""Frozen-set Evaluation and Monitoring Graph with deterministic promotion gates."""

from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

MAX_ALLOWED_RECALL_REGRESSION = 0.03
MAX_ALLOWED_CITATION_REGRESSION = 0.02


class EvaluationState(TypedDict, total=False):
    cases: list[dict[str, Any]]
    current_metrics: dict[str, float]
    baseline_metrics: dict[str, float]
    live_retrieval_payload: dict[str, Any]
    held_out_labels: list[dict[str, Any]]
    scored_metrics: dict[str, float]
    promotion_state: str
    reasons: list[str]
    workflow_steps: list[str]


def build_evaluation_run(cases: list[dict[str, Any]]) -> dict[str, Any]:
    """Build only question/filter data for the live retrieval leg of evaluation."""
    live_cases, held_out = [], []
    for case in cases:
        live_cases.append({key: case[key] for key in ("question", "language", "route", "source_type") if key in case})
        held_out.append({key: case[key] for key in ("expected_answer", "expected_evidence_ids", "expects_abstention") if key in case})
    return {"live_retrieval_payload": {"cases": live_cases}, "held_out_labels": held_out, "case_count": len(cases)}


def promotion_decision(current: dict[str, float], baseline: dict[str, float]) -> dict[str, Any]:
    reasons = []
    if float(current.get("recall_at_5", 0)) < float(baseline.get("recall_at_5", 0)) - MAX_ALLOWED_RECALL_REGRESSION:
        reasons.append("recall_at_5_regression")
    if float(current.get("citation_correctness", 0)) < float(baseline.get("citation_correctness", 0)) - MAX_ALLOWED_CITATION_REGRESSION:
        reasons.append("citation_correctness_regression")
    return {"promotion_state": "blocked" if reasons else "accepted", "reasons": reasons, "threshold_version": "evaluation-gate-v1"}


def build_evaluation_graph(checkpointer=None):
    """Compile the fixed frozen-set evaluation and promotion workflow."""
    def step(state: EvaluationState, name: str, **update: Any):
        return {"workflow_steps": [*(state.get("workflow_steps") or []), name], **update}

    def load_frozen_evaluation_set(state: EvaluationState):
        run = build_evaluation_run(state["cases"])
        return step(state, "load_frozen_evaluation_set", live_retrieval_payload=run["live_retrieval_payload"], held_out_labels=run["held_out_labels"])

    def execute_cases(state: EvaluationState):
        return step(state, "execute_cases")

    def score_retrieval_and_answer(state: EvaluationState):
        return step(state, "score_retrieval_and_answer", scored_metrics=dict(state["current_metrics"]))

    def compare_baseline(state: EvaluationState):
        decision = promotion_decision(state["scored_metrics"], state["baseline_metrics"])
        return step(state, "compare_baseline", promotion_state=decision["promotion_state"], reasons=decision["reasons"])

    def promotion_route(state: EvaluationState):
        return "block" if state["promotion_state"] == "blocked" else "accept"

    def block_promotion(state: EvaluationState):
        return step(state, "block_promotion")

    def record_accepted_run(state: EvaluationState):
        return step(state, "record_accepted_run")

    workflow = StateGraph(EvaluationState)
    workflow.add_node("load_frozen_evaluation_set", load_frozen_evaluation_set)
    workflow.add_node("execute_cases", execute_cases)
    workflow.add_node("score_retrieval_and_answer", score_retrieval_and_answer)
    workflow.add_node("compare_baseline", compare_baseline)
    workflow.add_node("block_promotion", block_promotion)
    workflow.add_node("record_accepted_run", record_accepted_run)
    workflow.add_edge(START, "load_frozen_evaluation_set")
    workflow.add_edge("load_frozen_evaluation_set", "execute_cases")
    workflow.add_edge("execute_cases", "score_retrieval_and_answer")
    workflow.add_edge("score_retrieval_and_answer", "compare_baseline")
    workflow.add_conditional_edges("compare_baseline", promotion_route, {"block": "block_promotion", "accept": "record_accepted_run"})
    workflow.add_edge("block_promotion", END)
    workflow.add_edge("record_accepted_run", END)
    return workflow.compile(checkpointer=checkpointer)

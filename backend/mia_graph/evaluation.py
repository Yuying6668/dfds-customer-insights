"""Frozen-set Evaluation and Monitoring Graph with deterministic promotion gates."""

import math
import json
from typing import Any, Protocol, TypedDict

from langgraph.graph import END, START, StateGraph
from .retry import run_with_recovery
from .contracts import _reject_untrusted

MAX_ALLOWED_RECALL_REGRESSION = 0.03
MAX_ALLOWED_CITATION_REGRESSION = 0.02
MINIMUM_METRICS = {
    "recall_at_5": 0.80,
    "citation_correctness": 0.80,
    "answer_quality": 0.80,
    "abstention_accuracy": 0.90,
}
MAXIMUM_METRICS = {"p95_latency_ms": 5000.0, "failure_rate": 0.05}
HUMAN_CALIBRATION_DIMENSIONS = (
    "groundedness",
    "citation_correctness",
    "answer_completeness",
    "uncertainty_calibration",
    "policy_safety",
)


class EvaluationState(TypedDict, total=False):
    cases: list[dict[str, Any]]
    current_metrics: dict[str, float]
    baseline_metrics: dict[str, float]
    live_retrieval_payload: dict[str, Any]
    scored_metrics: dict[str, float]
    case_results: list[dict[str, Any]]
    metric_segments: dict[str, dict[str, float | int]]
    promotion_state: str
    reasons: list[str]
    workflow_steps: list[str]
    request_id: str
    trace_id: str
    graph_version: str
    idempotency_key: str
    retry: dict[str, Any]
    failure_state: str
    failure_node: str
    failure_error: str
    last_safe_state: dict[str, Any]
    human_review: dict[str, Any]


def _recall_at_5(case: dict[str, Any]) -> float | None:
    expected = {str(value) for value in case.get("expected_evidence_ids") or []}
    if not expected:
        return None
    retrieved = {str(value) for value in (case.get("retrieved_evidence_ids") or [])[:5]}
    return 1.0 if expected.intersection(retrieved) else 0.0


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _p95(values: list[float]) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return float(ordered[math.ceil(len(ordered) * 0.95) - 1])


def _score_metric_set(cases: list[dict[str, Any]]) -> dict[str, float | int]:
    successful = [case for case in cases if not case.get("failed")]
    factual_cases = [case for case in successful if case.get("expected_evidence_ids")]
    abstention_cases = [case for case in successful if case.get("expects_abstention")]
    recalls = [value for case in successful if (value := _recall_at_5(case)) is not None]
    citations = [1.0 if case.get("citation_correct") else 0.0 for case in successful if case.get("expected_evidence_ids")]
    quality = [float(case["judge_score"]) for case in successful if case.get("judge_score") is not None]
    abstentions = [
        1.0 if not case.get("retrieved_evidence_ids") else 0.0
        for case in successful if case.get("expects_abstention")
    ]
    latencies = [float(case["latency_ms"]) for case in cases if case.get("latency_ms") is not None]
    return {
        "cases": len(cases),
        "factual_cases": len(factual_cases),
        "abstention_cases": len(abstention_cases),
        "recall_at_5": _mean(recalls),
        "citation_correctness": _mean(citations),
        "answer_quality": _mean(quality),
        "abstention_accuracy": _mean(abstentions),
        "p95_latency_ms": _p95(latencies),
        "failure_rate": sum(1 for case in cases if case.get("failed")) / len(cases) if cases else 0.0,
    }


def _normalized_human_records(cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    records = []
    for index, case in enumerate(cases):
        review = case.get("human_review")
        if isinstance(review, dict):
            records.append({
                "case_id": str(review.get("case_id") or f"case-{index + 1}"),
                "dimension_scores": review.get("dimension_scores") or {dimension: float(review.get("overall_score", 0)) for dimension in HUMAN_CALIBRATION_DIMENSIONS},
                "overall_score": review.get("overall_score", 0), "citation_correct": review.get("citation_correct", False),
                "should_abstain": review.get("should_abstain", False), "policy_issue": review.get("policy_issue", False),
                "notes": str(review.get("notes") or "calibration"), "reviewer_id": str(review.get("reviewer_id") or "reviewer"),
                "reviewed_at": str(review.get("reviewed_at") or "unknown"), "judge_score": review.get("judge_score"),
            })
    return records


def score_evaluation_cases(cases: list[dict[str, Any]]) -> dict[str, Any]:
    """Return overall and required-dimensional metrics from completed case records."""
    segments: dict[str, dict[str, float | int]] = {}
    for dimension in ("language", "route", "source_type"):
        values = sorted({str(case.get(dimension) or "unknown") for case in cases})
        for value in values:
            segments[f"{dimension}:{value}"] = _score_metric_set(
                [case for case in cases if str(case.get(dimension) or "unknown") == value]
            )
    human_records = _normalized_human_records(cases)
    human_review = aggregate_human_calibration(human_records) if human_records else aggregate_human_calibration([])
    metrics = _score_metric_set(cases)
    if human_review["reviewed_cases"]:
        metrics.update({
            "human_overall_score": round(float(human_review["overall_score_mean"]) / 5.0, 3),
            "human_citation_correctness": human_review["citation_correctness_human"],
            "human_abstention_accuracy": human_review["abstention_accuracy_human"],
            "human_policy_issue_rate": human_review["policy_issue_rate"],
        })
        for key, segment in segments.items():
            _, value = key.split(":", 1)
            dimension = key.split(":", 1)[0]
            segment_cases = [case for case in cases if str(case.get(dimension) or "unknown") == value]
            segment_records = _normalized_human_records(segment_cases)
            if segment_records:
                segment_human = aggregate_human_calibration(segment_records)
                segment.update({
                    "human_overall_score": round(float(segment_human["overall_score_mean"]) / 5.0, 3),
                    "human_citation_correctness": segment_human["citation_correctness_human"],
                    "human_abstention_accuracy": segment_human["abstention_accuracy_human"],
                    "human_policy_issue_rate": segment_human["policy_issue_rate"],
                })
    return {"metrics": metrics, "segments": segments, "human_review": human_review}


def validate_human_calibration_record(record: dict[str, Any]) -> dict[str, Any]:
    """Validate one reviewer record without accepting raw prompts or identity data."""
    required = {"case_id", "dimension_scores", "overall_score", "citation_correct", "should_abstain", "policy_issue", "notes", "reviewer_id", "reviewed_at"}
    missing = sorted(required - set(record))
    if missing:
        raise ValueError(f"missing human calibration fields: {', '.join(missing)}")
    scores = record.get("dimension_scores")
    if not isinstance(scores, dict) or set(scores) != set(HUMAN_CALIBRATION_DIMENSIONS):
        raise ValueError("dimension_scores must contain the complete calibration rubric")
    normalized_scores = {}
    for dimension in HUMAN_CALIBRATION_DIMENSIONS:
        try:
            score = float(scores[dimension])
        except (TypeError, ValueError) as exc:
            raise ValueError(f"invalid human score for {dimension}") from exc
        if not 0.0 <= score <= 5.0:
            raise ValueError(f"human score for {dimension} must be between 0 and 5")
        normalized_scores[dimension] = score
    try:
        overall_score = float(record["overall_score"])
    except (TypeError, ValueError) as exc:
        raise ValueError("invalid overall human score") from exc
    if not 0.0 <= overall_score <= 5.0:
        raise ValueError("overall human score must be between 0 and 5")
    if not str(record["case_id"]).strip() or not str(record["reviewer_id"]).strip():
        raise ValueError("case_id and reviewer_id are required")
    notes = str(record["notes"]).strip()
    if not notes or len(notes) > 4000:
        raise ValueError("human calibration notes are required and must be <= 4000 characters")
    return {
        "case_id": str(record["case_id"]),
        "dimension_scores": normalized_scores,
        "overall_score": overall_score,
        "citation_correct": bool(record["citation_correct"]),
        "should_abstain": bool(record["should_abstain"]),
        "policy_issue": bool(record["policy_issue"]),
        "notes": notes,
        "reviewer_id": str(record["reviewer_id"]),
        "reviewed_at": str(record["reviewed_at"]),
        "judge_score": float(record["judge_score"]) if record.get("judge_score") is not None else None,
    }


def aggregate_human_calibration(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate reviewer scores while keeping automated judge metrics separate."""
    normalized = [validate_human_calibration_record(record) for record in records]
    if not normalized:
        return {"reviewed_cases": 0, "human_scores": {}, "judge_score_mean": None, "judge_human_agreement": None}
    human_scores = {
        dimension: round(_mean([record["dimension_scores"][dimension] for record in normalized]), 3)
        for dimension in HUMAN_CALIBRATION_DIMENSIONS
    }
    overall = round(_mean([record["overall_score"] for record in normalized]), 3)
    judge_scores = [record["judge_score"] for record in normalized if record["judge_score"] is not None]
    paired = [(record["overall_score"] / 5.0, record["judge_score"]) for record in normalized if record["judge_score"] is not None]
    agreement = round(_mean([1.0 - abs(human - judge) for human, judge in paired]), 3) if paired else None
    return {
        "reviewed_cases": len(normalized),
        "human_scores": human_scores,
        "overall_score_mean": overall,
        "citation_correctness_human": round(_mean([1.0 if record["citation_correct"] else 0.0 for record in normalized]), 3),
        "abstention_accuracy_human": round(_mean([1.0 if record["should_abstain"] else 0.0 for record in normalized]), 3),
        "policy_issue_rate": round(_mean([1.0 if record["policy_issue"] else 0.0 for record in normalized]), 3),
        "judge_score_mean": round(_mean(judge_scores), 3) if judge_scores else None,
        "judge_human_agreement": agreement,
    }


def parse_judge_verdict(value: str | dict[str, Any]) -> dict[str, Any]:
    """Validate the compact, versioned LLM-as-a-judge response contract."""
    payload = json.loads(value) if isinstance(value, str) else dict(value)
    score = float(payload.get("score"))
    if not 0.0 <= score <= 1.0:
        raise ValueError("judge score must be between 0 and 1")
    return {
        "judge_score": score,
        "citation_correct": bool(payload.get("citation_correct")),
        "judge_rubric_version": str(payload.get("rubric_version") or "answer-quality-v1"),
    }


def build_evaluation_run(cases: list[dict[str, Any]]) -> dict[str, Any]:
    """Build only question/filter data for the live retrieval leg of evaluation."""
    live_cases, label_vault = [], {}
    for index, case in enumerate(cases, start=1):
        case_id = str(case.get("case_id") or case.get("case_key") or f"case-{index}")
        live_cases.append({"case_id": case_id, **{key: case[key] for key in ("question", "language", "route", "source_type") if key in case}})
        label_vault[case_id] = {key: case[key] for key in ("expected_answer", "expected_evidence_ids", "expects_abstention", "human_review") if key in case}
    return {"live_retrieval_payload": {"cases": live_cases}, "label_vault": label_vault, "case_count": len(cases)}


class EvaluationServices(Protocol):
    """Live services receive only the question and permitted filters, never labels."""

    def retrieve_case(self, case: dict[str, Any]) -> dict[str, Any]: ...
    def answer_case(self, case: dict[str, Any], retrieval: dict[str, Any]) -> dict[str, Any]: ...
    def judge_case(self, result: dict[str, Any], labels: dict[str, Any]) -> dict[str, Any]: ...


def promotion_decision(current: dict[str, float], baseline: dict[str, float]) -> dict[str, Any]:
    reasons = []
    if not baseline:
        return {"promotion_state": "blocked", "reasons": ["baseline_required"], "threshold_version": "evaluation-gate-v1"}
    if float(current.get("recall_at_5", 0)) < float(baseline.get("recall_at_5", 0)) - MAX_ALLOWED_RECALL_REGRESSION:
        reasons.append("recall_at_5_regression")
    if float(current.get("citation_correctness", 0)) < float(baseline.get("citation_correctness", 0)) - MAX_ALLOWED_CITATION_REGRESSION:
        reasons.append("citation_correctness_regression")
    if "human_overall_score" in current and float(current["human_overall_score"]) < float(baseline.get("human_overall_score", 0.8)) - 0.05:
        reasons.append("human_review_regression")
    if float(current.get("human_policy_issue_rate", 0.0)) > 0.0:
        reasons.append("human_policy_issue")
    for metric, minimum in MINIMUM_METRICS.items():
        if metric in {"recall_at_5", "citation_correctness"} and int(current.get("factual_cases", 1)) == 0:
            continue
        if metric == "abstention_accuracy" and int(current.get("abstention_cases", 1)) == 0:
            continue
        if metric in current and float(current[metric]) < minimum:
            reasons.append(f"{metric}_below_minimum")
    for metric, maximum in MAXIMUM_METRICS.items():
        if metric in current and float(current[metric]) > maximum:
            reasons.append(f"{metric}_above_maximum")
    return {"promotion_state": "blocked" if reasons else "accepted", "reasons": reasons, "threshold_version": "evaluation-gate-v1"}


def build_evaluation_graph(checkpointer=None, services: EvaluationServices | None = None, label_vault: dict[str, dict[str, Any]] | None = None):
    """Compile the fixed frozen-set evaluation and promotion workflow."""
    vault = dict(label_vault or {})
    def step(state: EvaluationState, name: str, **update: Any):
        return {"workflow_steps": [*(state.get("workflow_steps") or []), name], **update}

    def safe(name, fn):
        def wrapped(state):
            return run_with_recovery(state, lambda: fn(state), node=name)
        return wrapped

    def load_frozen_evaluation_set(state: EvaluationState):
        _reject_untrusted({"cases": state["cases"]})
        return step(state, "load_frozen_evaluation_set", live_retrieval_payload={"cases": state["cases"]})

    def execute_cases(state: EvaluationState):
        if services is None:
            return step(state, "execute_cases")
        results = []
        for live_case in state["live_retrieval_payload"]["cases"]:
            labels = dict(vault.get(str(live_case["case_id"])) or {})
            holder: dict[str, Any] = {}
            outcome = run_with_recovery(state, lambda: holder.update({"retrieval": dict(services.retrieve_case(dict(live_case)) or {})}) or holder, node="execute_cases")
            if outcome.get("failure_state") == "failed":
                return step(state, "execute_cases", **outcome)
            retrieval = holder["retrieval"]
            holder.clear()
            outcome = run_with_recovery(state, lambda: holder.update({"answer": dict(services.answer_case(dict(live_case), dict(retrieval)) or {})}) or holder, node="execute_cases.answer")
            if outcome.get("failure_state") == "failed":
                return step(state, "execute_cases", **outcome)
            answer = holder["answer"]
            result = {
                **live_case,
                **retrieval,
                **answer,
                "latency_ms": float(retrieval.get("latency_ms") or 0) + float(answer.get("latency_ms") or 0),
                "failed": bool(retrieval.get("failed") or answer.get("failed")),
            }
            holder.clear()
            outcome = run_with_recovery(state, lambda: holder.update({"judge": services.judge_case(dict(result), dict(labels)) or {}}) or holder, node="execute_cases.judge")
            if outcome.get("failure_state") == "failed":
                return step(state, "execute_cases", **outcome)
            result.update(holder["judge"])
            results.append(result)
        return step(state, "execute_cases", case_results=results)

    def score_retrieval_and_answer(state: EvaluationState):
        if services is None:
            metrics = dict(state["current_metrics"])
            return step(state, "score_retrieval_and_answer", scored_metrics=metrics)
        scored_cases = [{**result, **dict(vault.get(str(result["case_id"])) or {})} for result in state.get("case_results") or []]
        report = score_evaluation_cases(scored_cases)
        return step(state, "score_retrieval_and_answer", scored_metrics=report["metrics"], metric_segments=report["segments"], human_review=report["human_review"])

    def compare_baseline(state: EvaluationState):
        decision = promotion_decision(state["scored_metrics"], state["baseline_metrics"])
        return step(state, "compare_baseline", promotion_state=decision["promotion_state"], reasons=decision["reasons"])

    def failure_route(state):
        return "failed" if state.get("failure_state") == "failed" else "next"

    def recover_failure(state):
        return step(state, "recover_failure", promotion_state="blocked", reasons=["execution_failed"], failure_state="failed")

    def promotion_route(state: EvaluationState):
        if state.get("failure_state") == "failed":
            return "failed"
        return "block" if state["promotion_state"] == "blocked" else "accept"

    def block_promotion(state: EvaluationState):
        return step(state, "block_promotion")

    def record_accepted_run(state: EvaluationState):
        return step(state, "record_accepted_run")

    workflow = StateGraph(EvaluationState)
    workflow.add_node("load_frozen_evaluation_set", safe("load_frozen_evaluation_set", load_frozen_evaluation_set))
    workflow.add_node("execute_cases", execute_cases)
    workflow.add_node("score_retrieval_and_answer", safe("score_retrieval_and_answer", score_retrieval_and_answer))
    workflow.add_node("compare_baseline", safe("compare_baseline", compare_baseline))
    workflow.add_node("block_promotion", safe("block_promotion", block_promotion))
    workflow.add_node("record_accepted_run", safe("record_accepted_run", record_accepted_run))
    workflow.add_node("recover_failure", recover_failure)
    workflow.add_edge(START, "load_frozen_evaluation_set")
    workflow.add_conditional_edges("load_frozen_evaluation_set", failure_route, {"failed": "recover_failure", "next": "execute_cases"})
    workflow.add_conditional_edges("execute_cases", failure_route, {"failed": "recover_failure", "next": "score_retrieval_and_answer"})
    workflow.add_conditional_edges("score_retrieval_and_answer", failure_route, {"failed": "recover_failure", "next": "compare_baseline"})
    workflow.add_conditional_edges("compare_baseline", promotion_route, {"failed": "recover_failure", "block": "block_promotion", "accept": "record_accepted_run"})
    workflow.add_conditional_edges("block_promotion", failure_route, {"failed": "recover_failure", "next": END})
    workflow.add_conditional_edges("record_accepted_run", failure_route, {"failed": "recover_failure", "next": END})
    workflow.add_edge("recover_failure", END)
    return workflow.compile(checkpointer=checkpointer)

"""Aggregate-only Dataset Insight Graph with idempotent publication."""

import copy
import hashlib
import uuid
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from .policy import decide_review
from .retry import run_with_recovery
from .contracts import validate_dataset_snapshot

_SNAPSHOTS: dict[str, dict[str, Any]] = {}
_ATTEMPTS: dict[str, int] = {}


class DatasetState(TypedDict, total=False):
    snapshot: dict[str, Any]
    run_id: str
    graph_version: str
    evidence_ids: list[Any]
    analysis_version: str
    idempotency_key: str
    aggregates: dict[str, Any]
    comparative_evidence: list[dict[str, Any]]
    patterns: list[dict[str, Any]]
    recommendations: list[dict[str, Any]]
    review: dict[str, Any]
    review_decision: dict[str, Any]
    review_policy_version: str
    publication_state: str
    workflow_steps: list[str]
    graph_run_id: str
    trace_id: str
    retry: dict[str, Any]
    failure_state: str
    failure_node: str
    failure_error: str
    last_safe_state: dict[str, Any]


def dataset_idempotency_key(run_id: str, analysis_version: str, graph_version: str) -> str:
    return hashlib.sha256(f"{run_id}:{analysis_version}:{graph_version}".encode("utf-8")).hexdigest()


def _step(state: DatasetState, name: str, **update: Any) -> dict[str, Any]:
    return {"workflow_steps": [*(state.get("workflow_steps") or []), name], **update}


def normalize_comparative_evidence(items: list[Any] | None) -> list[dict[str, Any]]:
    """Normalize external comparison records without admitting raw review content."""
    normalized = []
    for item in items or []:
        if isinstance(item, str):
            item = {"id": item}
        if not isinstance(item, dict) or not str(item.get("id") or "").strip():
            continue
        normalized.append({
            "id": str(item["id"]),
            "sourceType": str(item.get("sourceType") or "unknown_external"),
            "title": str(item.get("title") or "External comparison evidence"),
            "excerpt": str(item.get("excerpt") or "")[:500],
            "collectedAt": str(item.get("collectedAt") or ""),
            "reliability": str(item.get("reliability") or "unspecified"),
            "coverage": str(item.get("coverage") or "unspecified"),
        })
    return normalized


def normalize_recommendations(items: list[Any] | None, evidence: list[dict[str, Any]], default_confidence: float = 0.0) -> list[dict[str, Any]]:
    evidence_ids = [item["id"] for item in evidence]
    normalized = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        confidence = item.get("confidence", default_confidence)
        try:
            confidence = max(0.0, min(1.0, float(confidence)))
        except (TypeError, ValueError):
            confidence = default_confidence
        limitations = item.get("limitations") or ["No limitation supplied"]
        if isinstance(limitations, str):
            limitations = [limitations]
        normalized.append({
            **copy.deepcopy(item),
            "owner": str(item.get("owner") or "Unassigned"),
            "expectedImpact": str(item.get("expectedImpact") or "Impact not specified"),
            "limitations": [str(value) for value in limitations][:10],
            "confidence": confidence,
            "evidenceIds": [str(value) for value in (item.get("evidenceIds") or evidence_ids)],
        })
    return normalized


def build_dataset_graph(checkpointer=None):
    """Compile the fixed aggregate-only Dataset Insight Graph."""
    def load_approved_run(state: DatasetState):
        snapshot = copy.deepcopy(state["snapshot"])
        analysis_version = str(snapshot.get("analysisVersion") or "analysis-v1")
        return _step(state, "load_approved_run", analysis_version=analysis_version, idempotency_key=dataset_idempotency_key(str(state["run_id"]), analysis_version, str(state["graph_version"])))

    def build_safe_aggregates(state: DatasetState):
        snapshot = state["snapshot"]
        return _step(state, "build_safe_aggregates", aggregates={"metrics": copy.deepcopy(snapshot.get("metrics") or {}), "distributions": copy.deepcopy(snapshot.get("distributions") or {})})

    def retrieve_comparative_evidence(state: DatasetState):
        return _step(state, "retrieve_comparative_evidence", comparative_evidence=normalize_comparative_evidence(state.get("evidence_ids")))

    def analyse_patterns(state: DatasetState):
        return _step(state, "analyse_patterns", patterns=copy.deepcopy(state["snapshot"].get("insights") or []))

    def draft_recommendations(state: DatasetState):
        return _step(state, "draft_recommendations", recommendations=normalize_recommendations(state["snapshot"].get("recommendations"), state.get("comparative_evidence", []), 0.0))

    def validate_publication(state: DatasetState):
        recommendation = " ".join(str(item.get("type", "")) for item in state.get("recommendations", []) if isinstance(item, dict))
        comparative_evidence = state.get("comparative_evidence", [])
        decision = decide_review({"confidence": 0.9, "evidence_ids": [item["id"] for item in comparative_evidence], "recommendation": recommendation})
        supplied = copy.deepcopy(state.get("review_decision") or {})
        review = {"requires_human_review": decision.requires_human_review, "reasons": decision.reasons, **supplied}
        return _step(state, "validate_publication", review=review, review_policy_version=decision.policy_version)

    def publication_route(state: DatasetState):
        review = state["review"]
        approved = str(review.get("status") or "").lower() == "approved"
        return "publish" if approved and state.get("comparative_evidence") else "review"

    def safe(name, fn):
        def wrapped(state):
            return run_with_recovery(state, lambda: fn(state), node=name)
        return wrapped

    def failure_route(state):
        return "failed" if state.get("failure_state") == "failed" else "next"

    def recover_failure(state):
        return _step(state, "recover_failure", publication_state="failed", failure_state="failed")

    def queue_review(state: DatasetState):
        return _step(state, "queue_review", publication_state="pending_human_review")

    def publish_snapshot(state: DatasetState):
        return _step(state, "publish_snapshot", publication_state="published_snapshot")

    workflow = StateGraph(DatasetState)
    workflow.add_node("load_approved_run", safe("load_approved_run", load_approved_run))
    workflow.add_node("build_safe_aggregates", safe("build_safe_aggregates", build_safe_aggregates))
    workflow.add_node("retrieve_comparative_evidence", safe("retrieve_comparative_evidence", retrieve_comparative_evidence))
    workflow.add_node("analyse_patterns", safe("analyse_patterns", analyse_patterns))
    workflow.add_node("draft_recommendations", safe("draft_recommendations", draft_recommendations))
    workflow.add_node("validate_publication", safe("validate_publication", validate_publication))
    workflow.add_node("queue_review", safe("queue_review", queue_review))
    workflow.add_node("publish_snapshot", safe("publish_snapshot", publish_snapshot))
    workflow.add_node("recover_failure", recover_failure)
    workflow.add_edge(START, "load_approved_run")
    workflow.add_conditional_edges("load_approved_run", failure_route, {"failed": "recover_failure", "next": "build_safe_aggregates"})
    workflow.add_conditional_edges("build_safe_aggregates", failure_route, {"failed": "recover_failure", "next": "retrieve_comparative_evidence"})
    workflow.add_conditional_edges("retrieve_comparative_evidence", failure_route, {"failed": "recover_failure", "next": "analyse_patterns"})
    workflow.add_conditional_edges("analyse_patterns", failure_route, {"failed": "recover_failure", "next": "draft_recommendations"})
    workflow.add_conditional_edges("draft_recommendations", failure_route, {"failed": "recover_failure", "next": "validate_publication"})
    workflow.add_conditional_edges("validate_publication", publication_route, {"review": "queue_review", "publish": "publish_snapshot"})
    workflow.add_conditional_edges("queue_review", failure_route, {"failed": "recover_failure", "next": END})
    workflow.add_conditional_edges("publish_snapshot", failure_route, {"failed": "recover_failure", "next": END})
    workflow.add_edge("recover_failure", END)
    return workflow.compile(checkpointer=checkpointer)


def run_dataset_graph(snapshot: dict[str, Any], *, run_id: str, graph_version: str, evidence_ids: list[Any] | None = None, review_decision: dict[str, Any] | None = None, retry: bool = False, checkpointer=None, trace_id: str | None = None) -> dict[str, Any]:
    """Run the compiled graph against an approved aggregate snapshot only."""
    validate_dataset_snapshot(snapshot)
    analysis_version = str(snapshot.get("analysisVersion") or "analysis-v1")
    key = dataset_idempotency_key(run_id, analysis_version, graph_version)
    if key in _SNAPSHOTS and not retry:
        reused = copy.deepcopy(_SNAPSHOTS[key])
        reused["created_new_snapshot"] = False
        return reused
    if key not in _SNAPSHOTS and not retry and snapshot.get("idempotency_key") == key:
        reused = copy.deepcopy(snapshot)
        reused["created_new_snapshot"] = False
        _SNAPSHOTS[key] = copy.deepcopy(reused)
        _ATTEMPTS[key] = int(reused.get("attempt") or 1)
        return reused
    attempt = _ATTEMPTS.get(key, int(snapshot.get("attempt") or 0)) + 1
    _ATTEMPTS[key] = attempt
    trace_id = str(trace_id or uuid.uuid4())
    state = build_dataset_graph(checkpointer=checkpointer).invoke(
        {"snapshot": copy.deepcopy(snapshot), "run_id": run_id, "graph_version": graph_version, "evidence_ids": list(evidence_ids or []), "review_decision": copy.deepcopy(review_decision or {}), "trace_id": trace_id},
        config={"configurable": {"thread_id": f"dataset:{key}"}},
    )
    result = copy.deepcopy(snapshot)
    result.update({"graphVersion": graph_version, "graph_run_id": f"dataset:{key}", "trace_id": trace_id, "idempotency_key": key, "attempt": attempt, "evidence_ids": list(evidence_ids or []), "comparativeEvidence": state.get("comparative_evidence", []), "recommendations": state.get("recommendations", []), "created_new_snapshot": True, "reviewPolicyVersion": state.get("review_policy_version"), "review": state.get("review", {}), "publication_state": state.get("publication_state", "failed"), "workflow_steps": state.get("workflow_steps", []), "failure_state": state.get("failure_state", "none"), "last_safe_state": state.get("last_safe_state", {})})
    _SNAPSHOTS[key] = copy.deepcopy(result)
    return result

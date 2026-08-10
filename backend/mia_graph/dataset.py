"""Aggregate-only Dataset Insight Graph with idempotent publication."""

import copy
import hashlib
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from .policy import decide_review

_SNAPSHOTS: dict[str, dict[str, Any]] = {}


class DatasetState(TypedDict, total=False):
    snapshot: dict[str, Any]
    run_id: str
    graph_version: str
    evidence_ids: list[str]
    analysis_version: str
    idempotency_key: str
    aggregates: dict[str, Any]
    comparative_evidence: list[str]
    patterns: list[dict[str, Any]]
    recommendations: list[dict[str, Any]]
    review: dict[str, Any]
    review_policy_version: str
    publication_state: str
    workflow_steps: list[str]


def dataset_idempotency_key(run_id: str, analysis_version: str, graph_version: str) -> str:
    return hashlib.sha256(f"{run_id}:{analysis_version}:{graph_version}".encode("utf-8")).hexdigest()


def _step(state: DatasetState, name: str, **update: Any) -> dict[str, Any]:
    return {"workflow_steps": [*(state.get("workflow_steps") or []), name], **update}


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
        return _step(state, "retrieve_comparative_evidence", comparative_evidence=list(state.get("evidence_ids") or []))

    def analyse_patterns(state: DatasetState):
        return _step(state, "analyse_patterns", patterns=copy.deepcopy(state["snapshot"].get("insights") or []))

    def draft_recommendations(state: DatasetState):
        return _step(state, "draft_recommendations", recommendations=copy.deepcopy(state["snapshot"].get("recommendations") or []))

    def validate_publication(state: DatasetState):
        recommendation = " ".join(str(item.get("type", "")) for item in state.get("recommendations", []) if isinstance(item, dict))
        decision = decide_review({"confidence": 0.9, "evidence_ids": state.get("comparative_evidence", []), "recommendation": recommendation})
        return _step(state, "validate_publication", review={"requires_human_review": decision.requires_human_review, "reasons": decision.reasons}, review_policy_version=decision.policy_version)

    def publication_route(state: DatasetState):
        return "review" if state["review"]["requires_human_review"] else "publish"

    def queue_review(state: DatasetState):
        return _step(state, "queue_review", publication_state="pending_human_review")

    def publish_snapshot(state: DatasetState):
        return _step(state, "publish_snapshot", publication_state="published_snapshot")

    workflow = StateGraph(DatasetState)
    workflow.add_node("load_approved_run", load_approved_run)
    workflow.add_node("build_safe_aggregates", build_safe_aggregates)
    workflow.add_node("retrieve_comparative_evidence", retrieve_comparative_evidence)
    workflow.add_node("analyse_patterns", analyse_patterns)
    workflow.add_node("draft_recommendations", draft_recommendations)
    workflow.add_node("validate_publication", validate_publication)
    workflow.add_node("queue_review", queue_review)
    workflow.add_node("publish_snapshot", publish_snapshot)
    workflow.add_edge(START, "load_approved_run")
    workflow.add_edge("load_approved_run", "build_safe_aggregates")
    workflow.add_edge("build_safe_aggregates", "retrieve_comparative_evidence")
    workflow.add_edge("retrieve_comparative_evidence", "analyse_patterns")
    workflow.add_edge("analyse_patterns", "draft_recommendations")
    workflow.add_edge("draft_recommendations", "validate_publication")
    workflow.add_conditional_edges("validate_publication", publication_route, {"review": "queue_review", "publish": "publish_snapshot"})
    workflow.add_edge("queue_review", END)
    workflow.add_edge("publish_snapshot", END)
    return workflow.compile(checkpointer=checkpointer)


def run_dataset_graph(snapshot: dict[str, Any], *, run_id: str, graph_version: str, evidence_ids: list[str] | None = None) -> dict[str, Any]:
    """Run the compiled graph against an approved aggregate snapshot only."""
    analysis_version = str(snapshot.get("analysisVersion") or "analysis-v1")
    key = dataset_idempotency_key(run_id, analysis_version, graph_version)
    if key in _SNAPSHOTS:
        reused = copy.deepcopy(_SNAPSHOTS[key])
        reused["created_new_snapshot"] = False
        return reused
    state = build_dataset_graph().invoke({"snapshot": copy.deepcopy(snapshot), "run_id": run_id, "graph_version": graph_version, "evidence_ids": list(evidence_ids or [])})
    result = copy.deepcopy(snapshot)
    result.update({"graphVersion": graph_version, "idempotency_key": key, "attempt": 1, "evidence_ids": list(evidence_ids or []), "created_new_snapshot": True, "reviewPolicyVersion": state["review_policy_version"], "review": state["review"], "publication_state": state["publication_state"], "workflow_steps": state["workflow_steps"]})
    _SNAPSHOTS[key] = copy.deepcopy(result)
    return result

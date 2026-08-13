"""Pure review action validation shared by API and graph integrations."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


ACTION_TO_STATUS = {
    "approve": ("approved", "published"),
    "correct": ("corrected", "internal_only"),
    "reject": ("rejected", "internal_only"),
    "withdraw": ("withdrawn", "internal_only"),
    "request_reanalysis": ("pending_human_review", "internal_only"),
}

REVIEWABLE_STATUSES = {"pending", "pending_human_review", "needs_changes", "approved", "corrected", "rejected", "published", "published_snapshot"}


def transition_for_action(current_status: str, action: str) -> dict[str, str]:
    current = str(current_status or "").strip()
    action = str(action or "").strip().lower()
    if action not in ACTION_TO_STATUS:
        raise ValueError(f"Unsupported review action: {action}")
    if current not in REVIEWABLE_STATUSES:
        raise ValueError(f"Review item is not actionable from status: {current}")
    if action == "approve" and current in {"rejected", "withdrawn"}:
        raise ValueError(f"Cannot approve a {current} review item")
    if action == "withdraw" and current not in {"approved", "corrected", "published", "published_snapshot"}:
        raise ValueError("Only an approved or published item can be withdrawn")
    if action == "request_reanalysis" and current not in {"rejected", "corrected", "needs_changes", "pending", "pending_human_review"}:
        raise ValueError("Re-analysis must follow a review decision")
    next_status, publish_state = ACTION_TO_STATUS[action]
    return {"next_status": next_status, "publish_state": publish_state}


def action_record(*, item_id: Any, action: str, current_status: str, actor_id: str,
                  rationale: str = "", correction: str = "", graph_run_id: str = "",
                  trace_id: str = "", idempotency_key: str = "") -> dict[str, Any]:
    action = str(action).strip().lower()
    rationale = str(rationale or "").strip()
    correction = str(correction or "").strip()
    if not rationale:
        raise ValueError("Rationale is required for every review action")
    if action == "correct" and not correction:
        raise ValueError("Correction content is required for a correction action")
    transition = transition_for_action(current_status, action)
    return {
        "review_item_id": str(item_id),
        "action_type": action,
        "actor_id": str(actor_id),
        "rationale": rationale,
        "correction": correction,
        "graph_run_id": str(graph_run_id or ""),
        "trace_id": str(trace_id or ""),
        "idempotency_key": str(idempotency_key or ""),
        "previous_status": str(current_status),
        "next_status": transition["next_status"],
        "publish_state": transition["publish_state"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def review_item_payload_for_graph(*, graph_name: str, graph_run_id: str, trace_id: str,
                                  title: str, reason: str, recommendation: str,
                                  evidence_ids: list[str], route_key: str = "all") -> dict[str, Any]:
    """Produce the minimum safe review item shape for a graph-held artifact."""
    return {
        "subject_type": f"{graph_name}_graph",
        "subject_id": str(graph_run_id),
        "subject_label": str(title)[:240],
        "layer": "publication",
        "status": "pending_human_review",
        "severity": "high",
        "title": str(title)[:240],
        "reason": str(reason)[:4000],
        "recommendation": str(recommendation)[:4000],
        "publish_state": "internal_only",
        "route_key": str(route_key or "all")[:120],
        "source_key": f"{graph_name}-graph",
        "metadata": {
            "graph_name": str(graph_name),
            "graph_run_id": str(graph_run_id),
            "trace_id": str(trace_id),
            "evidence_ids": [str(item) for item in evidence_ids],
            "review_policy_version": "review-policy-v1",
        },
    }

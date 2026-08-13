"""Deterministic trigger adapters for refresh and component-version changes.

Deployments may call these handlers from a queue, cron, or managed scheduler;
the handlers are idempotent and return the graph invocation contract.
"""

from __future__ import annotations

import hashlib
from typing import Any, Callable


def _key(*parts: str) -> str:
    return hashlib.sha256(":".join(parts).encode("utf-8")).hexdigest()


def on_external_refresh_complete(event: dict[str, Any], run_dataset: Callable[..., dict[str, Any]]) -> dict[str, Any]:
    """Trigger Dataset Graph after an approved external refresh completes."""
    if str(event.get("status") or "").lower() not in {"completed", "succeeded", "success"}:
        return {"triggered": False, "reason": "refresh_not_complete"}
    run_id = str(event.get("run_id") or event.get("batch_id") or "")
    if not run_id:
        raise ValueError("refresh event requires run_id or batch_id")
    graph_version = str(event.get("graph_version") or "mia-graph-v1")
    result = run_dataset(snapshot=event["snapshot"], run_id=run_id, graph_version=graph_version, evidence_ids=event.get("evidence_ids") or [], trace_id=event.get("trace_id"))
    return {"triggered": True, "graph": "dataset", "idempotency_key": result.get("idempotency_key") or _key(run_id, graph_version), "result": result}


def on_component_version_change(event: dict[str, Any], run_evaluation: Callable[..., dict[str, Any]]) -> dict[str, Any]:
    """Trigger Evaluation Graph when a model/prompt/retriever component changes."""
    component = str(event.get("component") or "").strip().lower()
    if component not in {"model", "prompt", "retriever", "embedding", "reranker", "chunker", "graph"}:
        return {"triggered": False, "reason": "unsupported_component"}
    version = str(event.get("version") or "").strip()
    if not version:
        raise ValueError("version change event requires version")
    result = run_evaluation(cases=event.get("cases") or [], baseline_metrics=event.get("baseline_metrics") or {}, graph_version=str(event.get("graph_version") or "mia-graph-v1"), trace_id=event.get("trace_id"), idempotency_key=_key(component, version), trigger_event=dict(event))
    return {"triggered": True, "graph": "evaluation", "component": component, "version": version, "idempotency_key": _key(component, version), "result": result}


class MiaTriggerScheduler:
    """Scheduler adapter: call ``poll`` from cron/worker at the desired cadence."""

    def __init__(self, *, run_dataset: Callable[..., dict[str, Any]], run_evaluation: Callable[..., dict[str, Any]]):
        self.run_dataset = run_dataset
        self.run_evaluation = run_evaluation
        self._seen_versions: set[str] = set()

    def poll_external_refresh(self, event: dict[str, Any]) -> dict[str, Any]:
        return on_external_refresh_complete(event, self.run_dataset)

    def poll_version_change(self, event: dict[str, Any]) -> dict[str, Any]:
        marker = _key(str(event.get("component") or ""), str(event.get("version") or ""))
        if marker in self._seen_versions:
            return {"triggered": False, "reason": "version_already_evaluated", "idempotency_key": marker}
        result = on_component_version_change(event, self.run_evaluation)
        if result.get("triggered"):
            self._seen_versions.add(marker)
        return result

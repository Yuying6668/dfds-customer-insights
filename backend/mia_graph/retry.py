"""Small bounded retry contract shared by Mia graph nodes."""

from __future__ import annotations

import copy
from typing import Any, Callable

MAX_NODE_ATTEMPTS = 3


def run_with_recovery(state: dict[str, Any], operation: Callable[[], dict[str, Any] | None], *, node: str, max_attempts: int = MAX_NODE_ATTEMPTS) -> dict[str, Any]:
    """Run a node with a hard attempt bound and preserve the last safe state."""
    retry = dict(state.get("retry") or {})
    # Attempts are bounded per node; the state still records the current node.
    attempts = 0
    last_safe = copy.deepcopy(state.get("last_safe_state") or state)
    for attempt in range(1, max_attempts + 1):
        try:
            update = operation() or {}
            return {**update, "retry": {"node": node, "attempts": attempts + attempt, "max_attempts": max_attempts}, "failure_state": "none", "last_safe_state": copy.deepcopy({**state, **update})}
        except Exception as exc:
            if attempt == max_attempts:
                return {"failure_state": "failed", "failure_node": node, "failure_error": str(exc)[:500], "retry": {"node": node, "attempts": attempts + attempt, "max_attempts": max_attempts}, "last_safe_state": last_safe}
    return {"failure_state": "failed", "failure_node": node, "retry": {"node": node, "attempts": attempts + max_attempts, "max_attempts": max_attempts}, "last_safe_state": last_safe}

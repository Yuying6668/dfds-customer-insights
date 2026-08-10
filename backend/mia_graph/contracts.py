"""Typed inputs and state contracts shared by Mia graphs."""

from dataclasses import dataclass, field
from typing import Any

RESTRICTED_KEYS = {
    "rows", "raw_rows", "raw_upload", "email", "phone", "address",
    "credentials", "password", "evaluation_answers", "expected_answer",
}


def _reject_untrusted(value: Any, path: str = "") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = str(key).lower()
            if normalized in RESTRICTED_KEYS or normalized.endswith("_rows"):
                raise ValueError("raw upload rows or restricted graph input")
            _reject_untrusted(child, f"{path}.{key}")
    elif isinstance(value, list):
        for child in value:
            _reject_untrusted(child, path)


@dataclass(frozen=True)
class ConversationInput:
    message: str
    actor_id: str
    filters: dict[str, Any] = field(default_factory=dict)
    approved_batch_id: str | None = None
    approved_batch_metadata: dict[str, Any] = field(default_factory=dict)
    upload_context: dict[str, Any] | None = None
    evidence_ids: list[str] = field(default_factory=list)
    request_id: str | None = None

    def __post_init__(self):
        if not str(self.message).strip():
            raise ValueError("message is required")
        if not str(self.actor_id).strip():
            raise ValueError("actor_id is required")
        _reject_untrusted({"filters": self.filters, "approved_batch_metadata": self.approved_batch_metadata, "upload_context": self.upload_context or {}})


@dataclass(frozen=True)
class GraphState:
    request_id: str
    actor_id: str
    graph_version: str = "mia-graph-v1"
    trace_id: str | None = None

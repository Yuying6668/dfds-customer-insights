"""Redacted observability adapters with no-op behaviour when providers are absent."""

import hashlib
import json
import time
from typing import Any


def _hash(value: Any) -> str:
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


def graph_audit_record(state: dict[str, Any]) -> dict[str, Any]:
    allowed = ("graph", "graph_version", "request_id", "trace_id", "idempotency_key", "status", "evidence_ids", "scores", "verdict", "publication_state")
    record = {key: state[key] for key in allowed if key in state}
    if "evidence_ids" in record:
        record["evidence_ids"] = [str(item) for item in record["evidence_ids"]]
    record["metadata_hash"] = _hash(json.dumps(record, sort_keys=True, default=str))
    return record


class RedactedTracer:
    def __init__(self, client=None):
        self.client = client

    def span(self, name: str, state: dict[str, Any]):
        started = time.perf_counter()
        tracer = self

        class _Span:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                if tracer.client is not None:
                    tracer.client.trace(name=name, metadata=graph_audit_record({**state, "duration_ms": round((time.perf_counter() - started) * 1000, 1)}))
                return False

        return _Span()

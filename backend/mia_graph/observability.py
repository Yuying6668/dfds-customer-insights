"""Redacted observability adapters with no-op behaviour when providers are absent."""

import hashlib
import json
import os
import time
import uuid
from typing import Any


def _hash(value: Any) -> str:
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


def graph_audit_record(state: dict[str, Any]) -> dict[str, Any]:
    allowed = ("graph", "graph_version", "request_id", "trace_id", "idempotency_key", "status", "evidence_ids", "scores", "verdict", "publication_state", "model_usage", "retrieval_version", "judge_rubric_version", "batch_id", "prompt_version", "config_version", "validation_verdict", "final_outcome", "duration_ms")
    record = {key: state[key] for key in allowed if key in state}
    record.setdefault("trace_id", str(uuid.uuid4()))
    if "evidence_ids" in record:
        record["evidence_ids"] = [str(item) for item in record["evidence_ids"]]
    record["metadata_hash"] = _hash(json.dumps(record, sort_keys=True, default=str))
    return record


def record_graph_result_trace(client, *, name: str, state: dict[str, Any], trace_id: str | None = None) -> dict[str, Any]:
    """Emit a final redacted graph result using the graph's existing trace ID."""
    record = graph_audit_record({**state, "trace_id": trace_id or state.get("trace_id")})
    if client is not None:
        try:
            client.trace(id=record["trace_id"], name=name, metadata=record)
        except Exception:
            pass
    return record


def configured_langfuse_client():
    """Return an optional provider client only when all required credentials exist."""
    if not (os.environ.get("LANGFUSE_PUBLIC_KEY") and os.environ.get("LANGFUSE_SECRET_KEY")):
        return None
    try:
        from langfuse import Langfuse
        return Langfuse()
    except Exception:
        return None


def langfuse_batch_deletion_sink(client=None):
    """Return a strict deletion callback when Langfuse is enabled.

    Deployments provide a client adapter exposing ``delete_traces_for_batch``.
    We deliberately fail closed when telemetry is configured but the adapter
    cannot delete the redacted trace metadata, so a tombstone remains retryable.
    """
    client = client if client is not None else configured_langfuse_client()
    if client is None:
        return None
    delete = getattr(client, "delete_traces_for_batch", None)
    if not callable(delete):
        def unavailable(_batch_id):
            raise RuntimeError("Configured Langfuse client has no batch trace deletion adapter")
        return unavailable
    return delete


class RedactedTracer:
    def __init__(self, client=None):
        self.client = client

    def span(self, name: str, state: dict[str, Any]):
        started = time.perf_counter()
        tracer = self
        trace_id = str(state.get("trace_id") or uuid.uuid4())

        class _Span:
            def __init__(self):
                self.trace_id = trace_id

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                if tracer.client is not None:
                    record = graph_audit_record({**state, "trace_id": trace_id, "duration_ms": round((time.perf_counter() - started) * 1000, 1)})
                    try:
                        # Use the same redacted ID as the provider trace key and audit metadata.
                        tracer.client.trace(id=trace_id, name=name, metadata=record)
                    except Exception:
                        # Provider telemetry must never affect graph execution.
                        pass
                return False

        return _Span()

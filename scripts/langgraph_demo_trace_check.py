#!/usr/bin/env python3
"""Verify the redacted Langfuse trace contract using an explicit demo provider."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.mia_graph.observability import record_graph_result_trace


class DemoLangfuseClient:
    """In-memory provider substitute used only for interview/demo evidence."""

    def __init__(self):
        self.records = []

    def trace(self, **record):
        self.records.append(record)


def main() -> int:
    client = DemoLangfuseClient()
    required = {"graph_version", "prompt_version", "config_version", "retrieval_version", "model_usage", "validation_verdict", "final_outcome"}
    for graph in ("conversation", "dataset", "evaluation"):
        trace_id = f"demo-{graph}-trace"
        record_graph_result_trace(client, name=f"mia.{graph}.result", trace_id=trace_id, state={
            "graph": graph,
            "graph_version": "mia-graph-v1",
            "request_id": f"demo-{graph}-run",
            "prompt_version": f"{graph}-v1",
            "config_version": "mia-config-v1",
            "retrieval_version": "hybrid-retrieval-v1",
            "model_usage": {"input_tokens": 0, "output_tokens": 0},
            "validation_verdict": ["demo-pass"],
            "final_outcome": "accepted",
        })
    records = [item["metadata"] for item in client.records]
    valid = len(records) == 3 and all(required.issubset(record) for record in records) and all(item["id"] == item["metadata"]["trace_id"] for item in client.records)
    report = {
        "status": "ready" if valid else "blocked",
        "mode": "demo-simulated",
        "provider": "in-memory-langfuse-contract-adapter",
        "graphs": [record["graph"] for record in records],
        "trace_ids": [record["trace_id"] for record in records],
        "warning": "Simulated provider trace verification only. No trace was sent to Langfuse.",
    }
    print(json.dumps(report))
    return 0 if valid else 2


if __name__ == "__main__":
    raise SystemExit(main())

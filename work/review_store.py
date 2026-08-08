#!/usr/bin/env python3
"""PostgreSQL persistence helpers for DFDS validation review results."""

from __future__ import annotations

import json
import os
from copy import deepcopy
from typing import Any


try:
    import psycopg
except ImportError:  # pragma: no cover - exercised only on machines without psycopg.
    psycopg = None


def configured_database_url(env: dict[str, str] | None = None) -> str:
    env = env or os.environ
    return env.get("REVIEW_DATABASE_URL") or env.get("DATABASE_URL") or ""


def connect_database(database_url: str | None = None):
    database_url = database_url or configured_database_url()
    if not database_url:
        raise RuntimeError("DATABASE_URL or REVIEW_DATABASE_URL is required for PG persistence")
    if psycopg is None:
        raise RuntimeError("psycopg is required for PG persistence")
    return psycopg.connect(database_url)


def jsonb(value: Any) -> str:
    return json.dumps(value if value is not None else {}, ensure_ascii=False)


def first_value(row: Any, key: str, index: int = 0) -> Any:
    if isinstance(row, dict):
        return row[key]
    return row[index]


def review_item_metadata(item: dict[str, Any]) -> dict[str, Any]:
    metadata = deepcopy(item.get("metadata") or {})
    metadata["evidence_chain"] = list(item.get("evidence_chain") or [])
    metadata["artifacts"] = list(item.get("artifacts") or [])
    metadata["validation_agent"] = "deterministic_mvp"
    return metadata


def review_run_values(result: dict[str, Any]) -> tuple[Any, ...]:
    run = result.get("run") or {}
    return (
        run.get("run_key"),
        run.get("run_type", "validation_batch"),
        run.get("trigger_source", "manual"),
        run.get("status", "completed"),
        run.get("started_at"),
        run.get("finished_at"),
        jsonb(run.get("input_snapshot") or {}),
        jsonb({"items": result.get("items", [])}),
        run.get("summary", ""),
        jsonb(run.get("metadata") or {"validation_agent": "deterministic_mvp"}),
    )


def review_item_values(item: dict[str, Any], run_id: int) -> tuple[Any, ...]:
    source_key = item.get("source_key") or str(item.get("source") or "validation-agent").lower().replace(" ", "-")
    return (
        run_id,
        item.get("subject_type", "chat_case"),
        item.get("subject_id") or item.get("review_key"),
        item.get("subject_label") or item.get("title"),
        item.get("layer", "retrieval"),
        item.get("status", "pending"),
        item.get("severity", "medium"),
        item.get("title"),
        item.get("reason"),
        item.get("recommendation"),
        item.get("publish_state", "internal_only"),
        item.get("route_key", "all"),
        source_key,
        (item.get("metadata") or {}).get("language"),
        item.get("original_output", ""),
        item.get("supervisor_verdict", ""),
        item.get("suggested_fix", ""),
        item.get("downstream_impact", ""),
        jsonb(review_item_metadata(item)),
    )


def persist_validation_result(result: dict[str, Any], conn=None, database_url: str | None = None) -> dict[str, Any]:
    owns_connection = conn is None
    conn = conn or connect_database(database_url)
    item_ids: list[int] = []

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO review_runs (
                  run_key, run_type, trigger_source, status, started_at, finished_at,
                  input_snapshot, output_snapshot, summary, metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s::jsonb)
                ON CONFLICT (run_key) DO UPDATE
                SET status = EXCLUDED.status,
                    finished_at = EXCLUDED.finished_at,
                    output_snapshot = EXCLUDED.output_snapshot,
                    summary = EXCLUDED.summary,
                    metadata = EXCLUDED.metadata
                RETURNING id
                """,
                review_run_values(result),
            )
            run_id = first_value(cur.fetchone(), "id")

            for item in result.get("items", []):
                cur.execute(
                    """
                    INSERT INTO review_items (
                      run_id, subject_type, subject_id, subject_label, layer, status,
                      severity, title, reason, recommendation, publish_state, route_key,
                      source_key, language, original_output, supervisor_verdict,
                      suggested_fix, downstream_impact, metadata
                    )
                    VALUES (
                      %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s::jsonb
                    )
                    RETURNING id
                    """,
                    review_item_values(item, run_id),
                )
                review_item_id = first_value(cur.fetchone(), "id")
                item_ids.append(review_item_id)

                for position, artifact in enumerate(item.get("artifacts") or [], start=1):
                    cur.execute(
                        """
                        INSERT INTO review_item_artifacts (
                          review_item_id, artifact_type, artifact_path, artifact_label, metadata
                        )
                        VALUES (%s, 'validation_artifact', %s, %s, %s::jsonb)
                        """,
                        (
                            review_item_id,
                            artifact,
                            artifact,
                            jsonb({"position": position, "source": "validation_agent"}),
                        ),
                    )

                cur.execute(
                    """
                    INSERT INTO review_item_actions (
                      review_item_id, actor_type, actor_name, action_type, notes
                    )
                    VALUES (%s, 'agent', 'validation_agent', %s, %s)
                    """,
                    (
                        review_item_id,
                        item.get("status", "pending"),
                        item.get("supervisor_verdict") or item.get("reason") or "",
                    ),
                )

        conn.commit()
        return {"run_id": run_id, "item_ids": item_ids, "item_count": len(item_ids)}
    except Exception:
        conn.rollback()
        raise
    finally:
        if owns_connection:
            conn.close()

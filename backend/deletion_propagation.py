"""Batch deletion tombstones and propagation across derived data layers.

The filesystem tombstone is intentionally small and contains no source data. It
is the local fallback for deployments where the database or external trace
provider is temporarily unavailable; database-backed deployments additionally
persist the same state in ``data_deletion_tombstones``.
"""

from __future__ import annotations

import hashlib
import json
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


LAYERS = (
    "raw_files",
    "cleaned_data",
    "evidence",
    "embeddings",
    "retrieval_cache",
    "analysis_snapshot",
    "langfuse_trace",
    "audit_trace",
)


class BatchDeletedError(FileNotFoundError):
    """Raised when a caller attempts to access a tombstoned batch."""


@dataclass(frozen=True)
class DeletionPlanItem:
    layer: str
    target: str
    action: str


@dataclass(frozen=True)
class DeletionResult:
    batch_id: str
    status: str
    tombstone_path: str
    completed_layers: tuple[str, ...]


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _actor_hash(actor_id: str) -> str:
    return hashlib.sha256(str(actor_id).encode("utf-8")).hexdigest()[:24]


def _reason_hash(reason: str) -> str:
    return hashlib.sha256(str(reason).encode("utf-8")).hexdigest()


def build_deletion_plan(batch_id: str, storage_root: str | Path) -> tuple[DeletionPlanItem, ...]:
    root = Path(storage_root)
    batch = root / str(batch_id)
    return tuple(
        DeletionPlanItem(layer, str(batch), "delete" if layer in {"raw_files", "cleaned_data", "analysis_snapshot"} else "tombstone")
        for layer in LAYERS
    )


def _tombstone_path(storage_root: str | Path, batch_id: str) -> Path:
    return Path(storage_root) / ".tombstones" / f"{batch_id}.json"


def is_batch_deleted(batch_id: str, storage_root: str | Path) -> bool:
    path = _tombstone_path(storage_root, batch_id)
    if not path.is_file():
        return False
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("status") == "completed"
    except (OSError, ValueError, json.JSONDecodeError):
        return True


def assert_batch_active(batch_id: str, storage_root: str | Path) -> None:
    if is_batch_deleted(batch_id, storage_root):
        raise BatchDeletedError(str(batch_id))


def register_lineage(connection, *, batch_id: str, layer: str, subject_type: str, subject_id: str, external_ref: str | None = None) -> None:
    """Register a derived object without storing its content in provenance."""
    if layer not in LAYERS:
        raise ValueError(f"Unsupported lineage layer: {layer}")
    with connection.cursor() as cur:
        cur.execute(
            """INSERT INTO data_lineage (batch_id, layer, subject_type, subject_id, external_ref)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (batch_id, layer, subject_type, subject_id) DO UPDATE
               SET external_ref = COALESCE(EXCLUDED.external_ref, data_lineage.external_ref), deleted_at = NULL""",
            (str(batch_id), layer, str(subject_type), str(subject_id), external_ref),
        )


def active_lineage(connection, batch_id: str) -> list[dict[str, Any]]:
    with connection.cursor() as cur:
        cur.execute(
            "SELECT layer, subject_type, subject_id, external_ref FROM data_lineage WHERE batch_id = %s AND deleted_at IS NULL ORDER BY layer, subject_type, subject_id",
            (str(batch_id),),
        )
        return [dict(row) for row in cur.fetchall()]


def _persist_db_tombstone(connection, batch_id: str, actor_id: str, reason: str, status: str) -> Any:
    with connection.cursor() as cur:
        cur.execute(
            """INSERT INTO data_deletion_tombstones
               (subject_type, subject_id, actor_hash, reason_hash, status, requested_at, completed_at)
               VALUES ('upload_batch', %s, %s, %s, %s, NOW(), CASE WHEN %s = 'completed' THEN NOW() ELSE NULL END)
               ON CONFLICT (subject_type, subject_id) DO UPDATE
               SET status = EXCLUDED.status, completed_at = EXCLUDED.completed_at
               RETURNING id""",
            (str(batch_id), _actor_hash(actor_id), _reason_hash(reason), status, status),
        )
        tombstone_id = cur.fetchone()["id"]
        for layer in LAYERS:
            cur.execute(
                """INSERT INTO deletion_propagation_tasks (tombstone_id, layer, status, completed_at)
                   VALUES (%s, %s, %s, CASE WHEN %s = 'completed' THEN NOW() ELSE NULL END)
                   ON CONFLICT (tombstone_id, layer) DO UPDATE
                   SET status = EXCLUDED.status, completed_at = EXCLUDED.completed_at""",
                (tombstone_id, layer, status, status),
            )
    return tombstone_id


def _purge_db_derived_rows(connection, batch_id: str) -> None:
    """Delete rows carrying the batch lineage while retaining tombstone metadata."""
    with connection.cursor() as cur:
        for table, subject_types in {
            "raw_source_rows": ("raw_source_rows", "raw_file"),
            "evidence_items": ("evidence_items", "evidence"),
            "raw_reviews": ("raw_reviews", "raw_review"),
            "insight_items": ("insight_items", "insight"),
            "project_memories": ("project_memories", "memory"),
        }.items():
            cur.execute(
                f"DELETE FROM {table} item USING data_lineage lineage WHERE lineage.batch_id = %s AND lineage.deleted_at IS NULL AND lineage.subject_type = ANY(%s) AND item.id::text = lineage.subject_id",
                (str(batch_id), list(subject_types)),
            )
        cur.execute("DELETE FROM graph_run_audits WHERE metadata->>'batch_id' = %s", (str(batch_id),))
        cur.execute("DELETE FROM rag_usage_events WHERE retrieval_trace->>'batch_id' = %s", (str(batch_id),))
        cur.execute("DELETE FROM insight_items WHERE metadata->>'batch_id' = %s", (str(batch_id),))
        cur.execute("DELETE FROM project_memories WHERE metadata->>'batch_id' = %s", (str(batch_id),))
        cur.execute("DELETE FROM evidence_items WHERE metadata->>'batch_id' = %s", (str(batch_id),))
        cur.execute("DELETE FROM upload_batches WHERE id = %s", (str(batch_id),))


def propagate_batch_deletion(
    batch_id: str,
    storage_root: str | Path,
    *,
    actor_id: str,
    reason: str,
    db_connection=None,
    trace_sink: Callable[[str], None] | None = None,
) -> DeletionResult:
    """Apply a deletion once; retries return the completed tombstone result."""
    batch_id = str(batch_id)
    tombstone = _tombstone_path(storage_root, batch_id)
    tombstone.parent.mkdir(parents=True, exist_ok=True)
    if is_batch_deleted(batch_id, storage_root):
        return DeletionResult(batch_id, "completed", str(tombstone), LAYERS)

    payload = {
        "batchId": batch_id,
        "status": "processing",
        "requestedAt": _now(),
        "actorHash": _actor_hash(actor_id),
        "reasonHash": _reason_hash(reason),
        "layers": list(LAYERS),
    }
    temporary = tombstone.with_suffix(".processing.json")
    temporary.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tombstone_id = None
    if db_connection is not None:
        tombstone_id = _persist_db_tombstone(db_connection, batch_id, actor_id, reason, "processing")

    batch_dir = Path(storage_root) / batch_id
    shutil.rmtree(batch_dir, ignore_errors=True)
    if db_connection is not None:
        _purge_db_derived_rows(db_connection, batch_id)
    # External observability providers must acknowledge their redacted trace
    # deletion before the tombstone is marked complete.
    if trace_sink is not None:
        trace_sink(batch_id)
    if db_connection is not None:
        _persist_db_tombstone(db_connection, batch_id, actor_id, reason, "completed")
        with db_connection.cursor() as cur:
            cur.execute(
                "UPDATE data_lineage SET deleted_at = NOW(), tombstone_id = %s WHERE batch_id = %s AND deleted_at IS NULL",
                (tombstone_id, str(batch_id)),
            )
        db_connection.commit()

    payload["status"] = "completed"
    payload["completedAt"] = _now()
    tombstone.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    temporary.unlink(missing_ok=True)
    return DeletionResult(batch_id, "completed", str(tombstone), LAYERS)

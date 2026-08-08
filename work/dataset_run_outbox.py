"""Durable local outbox for minute-level dataset-run processing."""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path


def now(): return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def enqueue(batch_dir, event_type="dataset-run.analysis-requested"):
    path = Path(batch_dir) / "outbox.json"
    events = json.loads(path.read_text()) if path.exists() else []
    pending = next((item for item in events if item["eventType"] == event_type and item["status"] in {"pending", "processing"}), None)
    if pending: return pending
    event = {"eventId": str(uuid.uuid4()), "eventType": event_type, "status": "pending", "createdAt": now(), "updatedAt": now()}
    events.append(event); path.write_text(json.dumps(events, indent=2)); return event

def claim(batch_dir):
    path = Path(batch_dir) / "outbox.json"
    if not path.exists(): return None
    events = json.loads(path.read_text())
    event = next((item for item in events if item["status"] == "pending"), None)
    if event: event.update({"status": "processing", "updatedAt": now()}); path.write_text(json.dumps(events, indent=2))
    return event

def complete(batch_dir, event_id, status="complete"):
    path = Path(batch_dir) / "outbox.json"; events = json.loads(path.read_text())
    for event in events:
        if event["eventId"] == event_id: event.update({"status": status, "updatedAt": now()})
    path.write_text(json.dumps(events, indent=2))

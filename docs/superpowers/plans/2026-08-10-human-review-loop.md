# Human Review Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified, auditable action workflow for graph-generated and legacy Review Console items.

**Architecture:** A small pure-Python transition module validates actions. PostgreSQL stores transition metadata and idempotency keys. `server.py` exposes an administrator-only action endpoint and the existing frontend renders action controls and history.

**Tech Stack:** Python unittest, PostgreSQL/psycopg, static ES modules, existing dashboard CSS.

---

### Task 1: Add transition rules

**Files:** Create `backend/review_workflow.py`; test `tests/test_review_workflow.py`.

- [ ] Write tests for all five actions, invalid states, and idempotent action identity.
- [ ] Run `python3 -m unittest tests.test_review_workflow -v` and confirm failure.
- [ ] Implement `ACTION_TO_STATUS`, `transition_for_action`, and `action_record` with explicit validation.
- [ ] Run the targeted tests and confirm pass.

### Task 2: Extend persistence and API

**Files:** Modify `db/schema.sql`, `server.py`; test `tests/review-api.test.mjs`.

- [ ] Add `graph_run_id`, `trace_id`, `previous_status`, `next_status`, `correction`, and `idempotency_key` to `review_item_actions`, with a uniqueness constraint.
- [ ] Add action-history loading to review item responses.
- [ ] Add `POST /api/review-items/:id/actions`, administrator authorization, transition validation, and idempotent replay.
- [ ] Keep `/status` as a compatibility adapter to the action endpoint semantics.
- [ ] Run Python and Node targeted tests.

### Task 3: Wire Review Console controls

**Files:** Modify `app/scripts/features/review-console.mjs`, `app/index.html`, `app/styles.css`; test `tests/review-console.test.mjs`.

- [ ] Render action controls and rationale/correction inputs only for database-backed items.
- [ ] Send action, rationale, correction, graph run, trace, and idempotency key.
- [ ] Render action history and refresh the selected item after success.
- [ ] Run the frontend tests and production build.

### Task 4: Integrate graph review metadata and verify

**Files:** Modify `backend/mia_graph/conversation.py`, `backend/mia_graph/dataset.py`, `server.py`; tests under `tests/mia_graph`.

- [ ] Preserve `graph_run_id` and `trace_id` in queued review state and persisted review metadata.
- [ ] Add regression tests for queued state metadata and complete action history.
- [ ] Run the full focused suite and build.

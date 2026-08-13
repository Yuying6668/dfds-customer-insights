# Human Review Loop Design

**Goal:** Connect graph outputs in `pending_human_review` to one auditable Review Console workflow.

## Scope

Conversation and Dataset Insight Graph outputs become review items with stable `graph_run_id` and `trace_id` metadata. Existing review items remain readable and are progressively handled by the same action API.

## Actions and state transitions

The action API accepts `approve`, `correct`, `reject`, `withdraw`, and `request_reanalysis`. A transition is valid only from a reviewable state, and every accepted action records the previous and next status. Approval sets `publish_state=published`; correction remains `corrected` and `internal_only`; rejection and withdrawal set `publish_state=internal_only`; re-analysis returns to `pending_human_review`.

## Audit and safety

Each action records the authenticated actor, timestamp, rationale, optional correction, graph run/trace references, idempotency key, and state transition. Repeating an idempotency key returns the original action without changing state again. Only administrators can mutate review items; reads retain existing authenticated/seed behavior.

## UI and compatibility

The Review Console keeps the existing queue and detail view, adds action-specific controls, rationale/correction fields, and an action history. Old status endpoint behavior remains compatible by translating statuses into actions. Seed items remain read-only when no database is configured.

## Verification

Unit tests cover transition rules, invalid transitions, idempotency, audit payloads, and API authorization. Browser-facing tests cover action rendering and request payloads. The acceptance path demonstrates approve, correct, reject, withdraw, and re-analysis with traceable history.

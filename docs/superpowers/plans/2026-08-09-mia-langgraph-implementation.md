# Mia LangGraph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LangGraph-based, privacy-safe orchestration to Mia without replacing deterministic ingestion, retrieval, validation, or review controls.

**Architecture:** `server.py` stays the HTTP boundary. A new `backend/mia_graph/` package owns typed state, deterministic policy checks, three independent graphs, checkpoint selection, and redacted observability. Existing server functions are injected as service callbacks so API contracts remain stable.

**Tech Stack:** Python 3.12, LangGraph, `langgraph-checkpoint-postgres`, Langfuse, Pydantic, psycopg, PostgreSQL/pgvector, unittest.

---

### Task 1: Create the graph foundation and policy layer

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/mia_graph/{__init__.py,contracts.py,policy.py,observability.py,checkpoint.py}`
- Create: `tests/mia_graph/{__init__.py,test_policy.py,test_observability.py}`

- [x] **Step 1: Write failing tests for forbidden graph input and review routing**

```python
def test_conversation_input_rejects_raw_upload_rows():
    with self.assertRaisesRegex(ValueError, "raw upload rows"):
        ConversationInput(message="Summarise", actor_id="u1", upload_context={"rows": [{"email": "a@example.com"}]})

def test_review_policy_queues_missing_citations_and_price_actions():
    decision = decide_review({"confidence": 0.98, "evidence_ids": [], "recommendation": "Change fare policy"})
    self.assertTrue(decision.requires_human_review)
    self.assertEqual(decision.reasons, ["missing_citations", "high_impact_recommendation"])
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `python3 -m unittest tests.mia_graph.test_policy -v`

Expected: FAIL because `backend.mia_graph` does not exist.

- [x] **Step 3: Add dependencies and minimal implementations**

Append these constraints to `backend/requirements.txt`:

```text
langgraph>=1.0,<2.0
langgraph-checkpoint-postgres>=3.0,<4.0
langfuse>=3.0,<4.0
pydantic>=2.0,<3.0
```

Implement `ConversationInput` as a Pydantic model that accepts only message, actor ID, filters, approved batch metadata, and evidence IDs. Reject `rows`, restricted fields, credentials, and evaluation answers. Implement `assess_untrusted_text()` with fixed injection patterns and `decide_review()` with the versioned `review-policy-v1` rules: missing citations, confidence below configured threshold, conflicting evidence, restricted data, high-impact recommendation, or suspected injection require review.

Implement a Langfuse adapter that stores only request IDs, hashes, timing, graph/config versions, evidence IDs, scores, and verdicts. It is a no-op without Langfuse credentials. Implement a checkpointer factory returning `MemorySaver` in tests and Postgres only when `LANGGRAPH_CHECKPOINT_DATABASE_URL` is configured.

- [x] **Step 4: Run targeted tests and commit**

Run: `python3 -m unittest tests.mia_graph.test_policy tests.mia_graph.test_observability -v`

Expected: PASS.

```bash
git add backend/requirements.txt backend/mia_graph tests/mia_graph
git commit -m "feat: add Mia graph safety foundation"
```

### Task 2: Route authenticated Mia chat through the Conversation Graph

**Files:**
- Create: `backend/mia_graph/conversation.py`
- Modify: `server.py:3520-3595`
- Create: `tests/mia_graph/test_conversation.py`

- [x] **Step 1: Write failing graph tests using fake services**

```python
def test_graph_returns_grounded_answer_without_review(self):
    graph = build_conversation_graph(FakeServices(evidence_ids=["e1"], confidence=0.96))
    state = graph.invoke({"message": "Why are reviews low?", "actor_id": "u1"})
    self.assertEqual(state["publication_state"], "returned")
    self.assertEqual(state["answer"]["evidence_ids"], ["e1"])

def test_graph_queues_high_impact_answer(self):
    graph = build_conversation_graph(FakeServices(evidence_ids=["e1"], confidence=0.96, recommendation="Change fare policy"))
    state = graph.invoke({"message": "What should we do?", "actor_id": "u1"})
    self.assertEqual(state["publication_state"], "pending_human_review")
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `python3 -m unittest tests.mia_graph.test_conversation -v`

Expected: FAIL because `build_conversation_graph` does not exist.

- [x] **Step 3: Implement the bounded graph**

Use `StateGraph` with only these nodes:

```python
workflow.add_node("route_request", services.route_request)
workflow.add_node("retrieve_evidence", services.retrieve_evidence)
workflow.add_node("analyse_or_answer", services.generate_answer)
workflow.add_node("validate_output", services.validate_draft)
workflow.add_node("queue_review", services.queue_review)
workflow.add_edge(START, "route_request")
workflow.add_edge("route_request", "retrieve_evidence")
workflow.add_edge("retrieve_evidence", "analyse_or_answer")
workflow.add_edge("analyse_or_answer", "validate_output")
workflow.add_conditional_edges("validate_output", services.review_route, {"review": "queue_review", "return": END})
workflow.add_edge("queue_review", END)
```

In `server.py`, build graph input from the authenticated identity and `uploaded_batch_chat_context()`, never from upload rows. Adapt existing `build_rag_context`, `call_deepseek`, `run_validation_harness`, `store_chat_turn`, and `record_rag_usage` as callbacks. Preserve existing API fields: `answer`, `evidence`, `usage`, `validation`, and `sessionId`.

- [x] **Step 4: Run focused tests and commit**

Run: `python3 -m unittest tests.mia_graph.test_conversation -v`

Expected: PASS.

```bash
git add backend/mia_graph/conversation.py server.py tests/mia_graph/test_conversation.py
git commit -m "feat: route Mia chat through LangGraph"
```

### Task 3: Add the Dataset Insight Graph with idempotent publication

**Files:**
- Create: `backend/mia_graph/dataset.py`
- Modify: `work/dataset_run.py`
- Modify: `server.py:2614-2688`
- Create: `tests/mia_graph/test_dataset.py`

- [x] **Step 1: Write failing idempotency and review tests**

```python
def test_dataset_graph_reuses_snapshot_for_identical_run(self):
    first = run_dataset_graph(SAFE_SNAPSHOT, run_id="run-1", graph_version="mia-graph-v1")
    second = run_dataset_graph(SAFE_SNAPSHOT, run_id="run-1", graph_version="mia-graph-v1")
    self.assertEqual(first["idempotency_key"], second["idempotency_key"])
    self.assertFalse(second["created_new_snapshot"])

def test_dataset_graph_holds_uncited_recommendation(self):
    state = run_dataset_graph(SAFE_SNAPSHOT, run_id="run-2", graph_version="mia-graph-v1", evidence_ids=[])
    self.assertEqual(state["publication_state"], "pending_human_review")
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `python3 -m unittest tests.mia_graph.test_dataset -v`

Expected: FAIL because `run_dataset_graph` does not exist.

- [x] **Step 3: Implement aggregate-only execution**

Use these fixed nodes: `load_approved_run -> build_safe_aggregates -> retrieve_comparative_evidence -> analyse_patterns -> draft_recommendations -> validate_publication -> [queue_review | publish_snapshot]`.

Derive `idempotency_key = sha256("{run_id}:{analysis_version}:{graph_version}")`. Persist `graphVersion`, `idempotencyKey`, `attempt`, `publicationState`, `reviewPolicyVersion`, and trace ID into the analytics snapshot. Reuse the current outbox for retry. Graph input is the existing aggregate snapshot and permitted evidence IDs only; it never contains raw rows or free text.

- [x] **Step 4: Run tests and commit**

Run: `python3 -m unittest tests.mia_graph.test_dataset tests.survey_pipeline.test_exports -v`

Expected: PASS.

```bash
git add backend/mia_graph/dataset.py work/dataset_run.py server.py tests/mia_graph/test_dataset.py
git commit -m "feat: add Mia dataset insight graph"
```

### Task 4: Add the Evaluation and Monitoring Graph

**Files:**
- Create: `backend/mia_graph/evaluation.py`
- Modify: `backend/rag_evaluation.py`
- Create: `tests/mia_graph/test_evaluation.py`

- [x] **Step 1: Write failing promotion-gate tests**

```python
def test_regressed_recall_blocks_promotion(self):
    result = promotion_decision({"recall_at_5": 0.82, "citation_correctness": 0.96}, {"recall_at_5": 0.90, "citation_correctness": 0.95})
    self.assertEqual(result["promotion_state"], "blocked")
    self.assertIn("recall_at_5_regression", result["reasons"])

def test_heldout_expected_answers_never_reach_live_retrieval(self):
    run = build_evaluation_run([{ "question": "Q", "expected_answer": "secret", "expected_evidence_ids": ["e1"] }])
    self.assertNotIn("expected_answer", run["live_retrieval_payload"])
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `python3 -m unittest tests.mia_graph.test_evaluation -v`

Expected: FAIL because the evaluation graph does not exist.

- [~] **Step 3: Implement evaluation and gate**

The graph, frozen-set isolation, segmented metrics, judge contract, and promotion gates are implemented. Human-audited calibration scoring and its persistence are still outstanding.

The graph is `load_frozen_evaluation_set -> execute_cases -> score_retrieval_and_answer -> compare_baseline -> [block_promotion | record_accepted_run]`. Record metric segments by language, route, and source tier; configuration versions; automated LLM-judge rubric score; human calibration score; latency; and baseline comparison. Keep held-out expected answers and evidence labels outside every live retrieval payload.

- [x] **Step 4: Run tests and commit**

Run: `python3 -m unittest tests.mia_graph.test_evaluation -v`

Expected: PASS.

```bash
git add backend/mia_graph/evaluation.py backend/rag_evaluation.py tests/mia_graph/test_evaluation.py
git commit -m "feat: add Mia evaluation graph"
```

### Task 5: Persist redacted audit metadata and verify the platform

**Files:**
- Modify: `db/schema.sql`
- Modify: `README.md`
- Modify: `server.py`
- Modify: `tests/mia_graph/test_observability.py`

- [x] **Step 1: Write a failing audit-redaction test**

```python
def test_graph_audit_never_persists_raw_text_or_identity_values(self):
    record = graph_audit_record({"message": "email a@example.com", "actor_id": "u1"})
    self.assertNotIn("message", record)
    self.assertNotIn("a@example.com", json.dumps(record))
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `python3 -m unittest tests.mia_graph.test_observability -v`

Expected: FAIL because `graph_audit_record` does not exist.

- [x] **Step 3: Add audit storage and operational documentation**

Add a `graph_run_audits` table with graph name/version, idempotency key, status, trace ID, redacted JSON metadata, and timestamp. Do not add raw prompt, raw review, or identity columns. Document `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`, `LANGGRAPH_CHECKPOINT_DATABASE_URL`, processor/data-residency requirements, retention, and the no-raw-data trace rule.

- [~] **Step 4: Run full verification and commit**

The repository verification passes using the project `.venv` and bundled Node runtime. A production database-backed checkpoint and the external governance gate still require deployment evidence.

Run: `python3 -m unittest tests.mia_graph tests.survey_pipeline tests.test_identity_rules -v && npm test && npm run build`

Expected: all tests and the production build PASS.

```bash
git add db/schema.sql README.md server.py backend/mia_graph tests/mia_graph
git commit -m "docs: document Mia graph operations"
```

## Plan Self-Review

- Deterministic ingestion, three independent graphs, prompt-injection containment, review policy, idempotency, checkpoints, Langfuse redaction, evaluation, and regression gates are each covered by a test-first task.
- Enterprise SSO/MFA, DPA execution, legal DPIA assessment, and source contracts are deployment prerequisites; they are not falsely represented as completed repository features.

## Acceptance Closure (2026-08-10)

`[ ]` remains on the historical Step 2 items because the original red-phase runs were not recorded and were not recreated during acceptance; this does not invalidate the current green verification, but preserves an honest audit trail.

- **Code acceptance: PASS.** Three bounded LangGraph workflows are implemented and wired to the server boundary; graph policy, checkpoint selection, redacted audit metadata, review routing, idempotent dataset publication, and evaluation regression gates are covered by tests.
- **Verification evidence: PASS.** `.venv/bin/python -m unittest discover -s tests` passed (62 tests). With the bundled Node runtime, `pnpm test` passed (25 tests) and `pnpm build` passed.
- **Delivery demo: PASS.** `tests/test_delivery_demo.py` verifies the deterministic evidence chain and repeatable evaluation fixture.
- **Implementation closure: PASS.** Human calibration records are validated, aggregated separately from automated judge scores, and persistable through the administrator calibration endpoint. Conversation, Dataset, and Evaluation runs now propagate a shared redacted trace ID.
- **Runtime evidence gap: OPEN.** Conversation, Dataset, and Evaluation code paths now pass the same redacted ID as both Langfuse `id` and audit metadata, and emit a final result record with prompt/config versions, validation verdict, model usage, and final outcome. A live credentialed Langfuse run is still required to verify the external provider. Production OIDC/KMS/TLS/audit, processor/DPA, DPIA, prohibited-use, and training evidence must come from deployment/governance owners.
- **Evaluation operations closure: PASS (2026-08-11).** `GET /api/admin/evaluations/{id}` now returns the run, redacted case outcomes, metric segments, and trace metadata; Agent Control exposes a per-run detail view.
- **PostgreSQL runtime checkpoint closure: PASS (2026-08-11).** `scripts/langgraph_runtime_check.py` executed all three graphs against the configured local PostgreSQL saver and confirmed readable checkpoints for each graph.
- **Demo provider evidence closure: PASS (2026-08-11).** `scripts/langgraph_demo_trace_check.py` verifies the full redacted provider-trace contract for all three graphs through an explicitly simulated adapter. This supports an interview walkthrough only; a credentialed Langfuse deployment remains a real-production prerequisite.
- **Production acceptance: BLOCKED.** `scripts/production_preflight.py --pretty` reports missing runtime OIDC/KMS/TLS/audit evidence, processor/DPA evidence, DPIA approval, prohibited-use review, and operator training records.
- **Closure status: PARTIALLY COMPLETE.** The repository implementation is accepted; production release remains blocked until the open items above are closed.

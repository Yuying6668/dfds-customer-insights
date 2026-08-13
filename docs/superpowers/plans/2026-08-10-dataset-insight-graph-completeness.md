# Dataset Insight Graph Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Dataset Insight Graph outputs evidence-backed, review-gated, idempotent, and retryable without coupling them to Evaluation Graph or deletion propagation.

**Architecture:** Keep the existing aggregate-only graph and extend its typed state with normalized comparative evidence, recommendation metadata, and a review decision contract. Publication is allowed only for an explicit approved review decision; repeated requests reuse the immutable result, while an explicit retry creates a new attempt for the same dataset version.

**Tech Stack:** Python, LangGraph, unittest, existing `backend.mia_graph.dataset` module.

---

### Task 1: Define the Dataset Insight publication contract

**Files:**
- Modify: `tests/mia_graph/test_dataset.py`
- Modify: `backend/mia_graph/dataset.py`

- [ ] **Step 1: Write failing tests for evidence, recommendations, and review gating**

Add tests asserting that comparative evidence is normalized with provenance, recommendations contain owner/impact/limitations/confidence/evidence IDs, an unapproved run stays pending, and an approved run publishes.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `python -m unittest tests.mia_graph.test_dataset -v`
Expected: failures for missing normalized fields and automatic publication.

- [ ] **Step 3: Implement the smallest normalization and gate changes**

Add pure helpers for comparative evidence and recommendation normalization. Accept legacy evidence IDs as IDs with an explicit unknown source, but preserve richer external evidence metadata when supplied. Add `review_decision` to graph input/state and route to `published_snapshot` only when status is `approved`; otherwise route to `pending_human_review`.

- [ ] **Step 4: Run focused tests and the existing graph suite**

Run: `python -m unittest tests.mia_graph.test_dataset tests.mia_graph.test_checkpoint -v`
Expected: PASS.

### Task 2: Add retry semantics without creating a second dataset version

**Files:**
- Modify: `tests/mia_graph/test_dataset.py`
- Modify: `backend/mia_graph/dataset.py`

- [ ] **Step 1: Write a failing retry test**

Assert that the default repeated call returns the existing result, while `retry=True` returns the same idempotency key with an incremented attempt and does not mutate the first result.

- [ ] **Step 2: Run the retry test and verify it fails**

Run: `python -m unittest tests.mia_graph.test_dataset.DatasetGraphTests.test_retry_creates_new_attempt -v`
Expected: FAIL because retry is not supported.

- [ ] **Step 3: Implement bounded in-memory attempt tracking**

Track attempts by the base idempotency key, reuse the immutable result for normal calls, and create a new result for explicit retries while retaining the same dataset/run/analysis/graph identity.

- [ ] **Step 4: Run the full Python graph test suite**

Run: `python -m unittest discover -s tests/mia_graph -v`
Expected: PASS.

### Task 3: Document the independent delivery boundary

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-mia-agentic-customer-intelligence-design.md`

- [ ] **Step 1: Add an implementation note**

Document that Dataset Insight Graph consumes the review decision contract and emits immutable snapshots, while Review Console, Evaluation Graph, deletion propagation, and governance can ship independently against those contracts.

- [ ] **Step 2: Run the focused tests once more**

Run: `python -m unittest tests.mia_graph.test_dataset tests.mia_graph.test_checkpoint -v`
Expected: PASS.

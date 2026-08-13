# Mia Evaluation Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run authenticated, frozen Mia evaluation sets against real retrieval and answer services, persist auditable metrics and promotion verdicts, and emit redacted Langfuse traces.

**Architecture:** `backend/mia_graph/evaluation.py` owns pure graph orchestration and metric aggregation. `server.py` remains the authenticated HTTP boundary and injects the current retrieval/answer callbacks. PostgreSQL stores frozen set versions, runs, per-case outcomes, segments, baselines, and audit references; no answer labels are returned by administration APIs or placed in live retrieval inputs.

**Tech Stack:** Python 3.12, LangGraph, psycopg/PostgreSQL, existing hybrid retrieval and DeepSeek adapter, Langfuse, React/Vite, unittest and node:test.

---

### Task 1: Define frozen evaluation contracts and metric computation

**Files:**
- Modify: `backend/mia_graph/evaluation.py`
- Modify: `backend/rag_evaluation.py`
- Test: `tests/mia_graph/test_evaluation.py`
- Test: `work/test_rag_evaluation.py`

- [ ] Write failing tests for Recall@5, citation correctness, answer quality, abstention accuracy, P95 latency, failure rate, and language/route/source segments.
- [ ] Run `python3 -m unittest tests.mia_graph.test_evaluation work.test_rag_evaluation -v` and confirm the new assertions fail because metrics are absent.
- [ ] Implement pure `score_evaluation_cases(cases)` and `segment_metrics(cases)`; a case stores only its result, dimensions, latency, error flag, and withheld labels in a private structure.
- [ ] Run the same targeted tests and confirm they pass.

### Task 2: Execute frozen cases through injected real services

**Files:**
- Modify: `backend/mia_graph/evaluation.py`
- Modify: `server.py`
- Test: `tests/mia_graph/test_evaluation.py`

- [ ] Write a failing fake-service graph test proving labels are excluded from retrieval inputs and that retrieval, answer, and judge callbacks are invoked once per case.
- [ ] Run `python3 -m unittest tests.mia_graph.test_evaluation -v` and confirm it fails for the missing execution interface.
- [ ] Add `EvaluationServices`, make `execute_cases` call its retrieval/answer/judge callbacks, and score only after all cases finish. In `server.py`, adapt `build_rag_context`, `call_deepseek`, and validation output without exposing expected answers to either callback.
- [ ] Re-run the targeted test module and confirm it passes.

### Task 3: Persist frozen versions, results, segments, and baselines

**Files:**
- Modify: `db/schema.sql`
- Modify: `server.py`
- Test: `tests/mia_graph/test_evaluation.py`

- [ ] Write failing repository tests using a fake DB cursor for run creation, case result persistence, segment persistence, baseline lookup, and promotion verdict persistence.
- [ ] Run `python3 -m unittest tests.mia_graph.test_evaluation -v` and confirm failure.
- [ ] Add `mia_evaluation_set_versions`, `mia_evaluation_runs`, `mia_evaluation_case_results`, `mia_evaluation_metric_segments`, and `mia_evaluation_baselines`. Store label hashes and frozen-set version, never labels in result responses. First accepted run can be explicitly marked baseline; no implicit thresholds before one is loaded.
- [ ] Re-run the tests and confirm all pass.

### Task 4: Add administrator APIs and Agent Control results

**Files:**
- Modify: `server.py`
- Modify: `app/routes/AgentControlRoute.jsx`
- Modify: `app/styles.css`
- Test: `tests/mia_graph/test_evaluation.py`
- Test: `tests/auth-workspace.test.mjs`

- [ ] Write failing tests for administrator-only evaluation creation and a summary response without expected answers.
- [ ] Run `python3 -m unittest tests.mia_graph.test_evaluation -v && npm test -- auth-workspace.test.mjs` and confirm the new tests fail.
- [x] Add `POST /api/admin/evaluations`, `GET /api/admin/evaluations`, `GET /api/admin/evaluations/{id}`, and explicit baseline selection. Add Agent Control run trigger, loading/error states, latest metrics, gate verdict, segments, and trace references.
- [ ] Run focused Python and JavaScript tests and confirm they pass.

### Task 5: Emit Langfuse data and perform end-to-end verification

**Files:**
- Modify: `backend/mia_graph/observability.py`
- Modify: `server.py`
- Modify: `README.md`
- Test: `tests/mia_graph/test_observability.py`
- Test: `tests/mia_graph/test_evaluation.py`

- [ ] Write failing tests for a Langfuse-compatible trace containing hashed input, model usage, retrieval IDs, validation verdict, and no raw message, identity, upload, or expected answer.
- [ ] Run `python3 -m unittest tests.mia_graph.test_observability tests.mia_graph.test_evaluation -v` and confirm failure.
- [x] Implement an optional Langfuse adapter that uses installed credentials and otherwise records a local redacted trace ID. Trace each evaluation graph/case with configuration versions, model usage, retrieval trace, validation verdict, and final outcome.
- [ ] Run `python3 -m unittest tests.mia_graph work.test_rag_evaluation tests.test_identity_rules -v && npm test && npm run build`.

## Plan Self-Review

- Coverage: Task 1 covers every required metric and segmentation; Task 2 covers real execution and frozen-label isolation; Task 3 covers results, baselines, and audit persistence; Task 4 covers administrator trigger and operator visibility; Task 5 covers Langfuse and the repeatable verification path.
- Scope: Review Console, Dataset Insight publication, deletion propagation, production SSO/DPA/DPIA, and the final demo remain intentionally outside this batch and are not claimed as implemented.
- Ambiguity resolved: “answer quality” is a versioned judge score, while human calibration is separately stored through `POST /api/admin/evaluations/{runId}/calibration` when supplied. “Citation correctness” is evidence-ID overlap with withheld expected citations. A database outage returns a failed production run rather than falling back to in-memory records.
- Placeholder scan: no `TBD`, `TODO`, or deferred implementation steps remain.

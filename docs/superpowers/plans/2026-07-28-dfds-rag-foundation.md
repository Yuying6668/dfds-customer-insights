# DFDS RAG Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a reproducible, provenance-safe RAG baseline with lexical BM25-style retrieval, optional semantic retrieval, deterministic reranking, Top-5 evaluation, and a demo-ready trace API.

**Architecture:** Keep PostgreSQL/pgvector as the evidence store. Add focused retrieval and evaluation modules rather than extending `server.py` with ranking logic. Use a deterministic local lexical scorer for the small current corpus; expose a `LexicalRetriever` interface so a scale search backend can replace it without changing the chat contract. Semantic ranking is optional and never claimed active until 1536-D vectors are populated.

**Tech Stack:** Python 3.14, psycopg 3, pgvector, PostgreSQL 16/17, `rank-bm25`, OpenAI-compatible embeddings, Python `unittest`, existing React/Vite client.

---

## Feasibility Decisions

- `Recall@5 >= 0.90` is a held-out acceptance gate, not an implementation guarantee.
- PostgreSQL FTS is not labelled BM25. The initial exact BM25 scorer is `rank-bm25`; a later search-service adapter handles large corpora.
- Cross-encoder reranking is optional at runtime. The first implementation uses deterministic provenance/route-aware reranking and returns `rerankerAvailable: false`; a model-backed reranker is enabled only after a pinned model and hardware/privacy review.
- External crawling, live review APIs, and embedding credentials are out of scope until source authority and secrets are supplied.

## Files And Boundaries

| File | Responsibility |
| --- | --- |
| `backend/rag_retrieval.py` | Candidate model, BM25 scorer, semantic score fusion, deterministic reranker and response normalisation |
| `backend/rag_evaluation.py` | Recall@k, MRR, abstention and citation metric calculations; evaluation-run persistence SQL |
| `backend/rag_corpus.py` | Read-only PostgreSQL corpus loading and explicit provenance/source filters |
| `work/dfds_rag_heldout.json` | Frozen, non-indexed held-out questions with expected evidence IDs or source keys |
| `work/run_rag_evaluation.py` | CLI evaluation runner with JSON report output |
| `work/test_rag_retrieval.py` | Unit tests for lexical ranking, fusion, provenance and Top-5 output |
| `work/test_rag_evaluation.py` | Metric and evaluation-isolation tests |
| `server.py` | Narrow adapter replacing legacy retrieval and adding a trace-only endpoint |
| `backend/requirements.txt` | Add pinned lightweight BM25 dependency |
| `docs/dfds-rag-foundation-runbook.md` | Local start, index, evaluation and demo instructions |

### Task 1: Define Retrieval Contract And Tests

**Files:**
- Create: `work/test_rag_retrieval.py`
- Create: `backend/rag_retrieval.py`

- [ ] **Step 1: Write tests for deterministic lexical Top-5, route preference, synthetic labels and empty-query abstention.**

```python
def test_bm25_returns_expected_evidence_in_top_five():
    rows = [
        {"id": 11, "body": "DFDS app login loop hid a booking", "route_key": "dover-calais", "source_tier": "public_snapshot", "is_synthetic": False},
        {"id": 12, "body": "Onboard food was pleasant", "route_key": "all", "source_tier": "public_snapshot", "is_synthetic": False},
    ]
    result = retrieval.rank_evidence("app login booking", rows, route_key="dover-calais", limit=5)
    assert result.items[0].id == 11
    assert result.items[0].score_components["bm25"] > 0

def test_synthetic_rows_are_labelled_not_silently_promoted():
    result = retrieval.rank_evidence("delay", [SYNTHETIC_ROW], route_key="all", limit=5)
    assert result.items[0].is_synthetic is True
    assert result.items[0].source_tier == "synthetic_demo"
```

- [ ] **Step 2: Run the test before implementation.**

Run: `.venv/bin/python -m unittest work.test_rag_retrieval -v`  
Expected: import failure for `backend.rag_retrieval`.

- [ ] **Step 3: Implement the minimal isolated retrieval module.**

Expose `EvidenceCandidate`, `RankedEvidence`, `RetrievalResult`, `tokenize`, `rank_evidence`, and `rerank_candidates`. Tokenisation must preserve Chinese characters and normalise Latin tokens. Score fusion must use ranks rather than raw lexical/vector values. The deterministic reranker may only add bounded route, source-tier and evidence-type boosts; it must retain every score component.

- [ ] **Step 4: Rerun focused tests.**

Run: `.venv/bin/python -m unittest work.test_rag_retrieval -v`  
Expected: all tests pass.

### Task 2: Load Corpus Without Leaking Evaluation Data

**Files:**
- Create: `backend/rag_corpus.py`
- Modify: `work/test_rag_retrieval.py`

- [ ] **Step 1: Add failing tests proving the evidence query never reads `rag_evaluation_items` and preserves source-tier fields.**

```python
def test_corpus_query_only_reads_evidence_items():
    sql, params = corpus.build_evidence_corpus_query(route_key="dover-calais")
    assert "FROM evidence_items" in sql
    assert "rag_evaluation_items" not in sql
    assert params["route_key"] == "dover-calais"
```

- [ ] **Step 2: Run focused tests and confirm failure.**

Run: `.venv/bin/python -m unittest work.test_rag_retrieval -v`  
Expected: missing corpus module/function.

- [ ] **Step 3: Implement parameterised corpus query and mapper.**

Select only `evidence_items` joined to source/route metadata. Return evidence ID, original/translated content, keywords, route, source, source tier, synthetic flag, version and timestamp. Do not interpolate route or source values into SQL.

- [ ] **Step 4: Rerun focused tests.**

Run: `.venv/bin/python -m unittest work.test_rag_retrieval -v`  
Expected: all tests pass.

### Task 3: Add Held-Out Metrics And Runner

**Files:**
- Create: `backend/rag_evaluation.py`
- Create: `work/dfds_rag_heldout.json`
- Create: `work/run_rag_evaluation.py`
- Create: `work/test_rag_evaluation.py`

- [ ] **Step 1: Write failing tests for Recall@5, MRR@10, correct abstention and evaluation non-indexing.**

```python
def test_metrics_calculate_recall_at_five_and_mrr_at_ten():
    report = evaluation.score_cases([
        {"expected_evidence_ids": [7], "retrieved_evidence_ids": [2, 7]},
        {"expected_evidence_ids": [9], "retrieved_evidence_ids": [1, 3, 9]},
    ])
    assert report["recall_at_5"] == 1.0
    assert round(report["mrr_at_10"], 3) == 0.417
```

- [ ] **Step 2: Run tests and confirm failure.**

Run: `.venv/bin/python -m unittest work.test_rag_evaluation -v`  
Expected: import failure.

- [ ] **Step 3: Implement metrics and a non-writing JSON runner.**

The held-out fixture uses stable source keys until a populated database supplies durable evidence IDs. The runner must emit corpus version, retrieval configuration, each Top-5 list, rank of first relevant item, aggregate metrics and a `quality_gate_passed` Boolean. It must return `false` when no database/corpus is available and must never call the chat LLM.

- [ ] **Step 4: Rerun focused tests and a no-database runner smoke test.**

Run: `.venv/bin/python -m unittest work.test_rag_evaluation -v && .venv/bin/python work/run_rag_evaluation.py --no-persist --output /tmp/dfds-rag-evaluation.json`  
Expected: tests pass; runner writes a report that explicitly names unavailable database state when applicable.

### Task 4: Replace Legacy Server Retrieval Through An Adapter

**Files:**
- Modify: `server.py`
- Modify: `work/test_mia_response_structure.py`
- Modify: `work/test_server_keywords.py`

- [ ] **Step 1: Add failing contract tests for response retrieval metadata.**

```python
def test_rag_context_exposes_retrieval_mode_and_provenance():
    context = server.build_rag_context({"message": "app login", "routeKey": "dover-calais"})
    assert "retrieval" in context
    assert context["retrieval"]["mode"] in {"bm25", "hybrid", "unavailable"}
```

- [ ] **Step 2: Run focused tests and confirm failure.**

Run: `.venv/bin/python -m unittest work.test_mia_response_structure work.test_server_keywords -v`  
Expected: assertion failure because the legacy context has no retrieval metadata.

- [ ] **Step 3: Adapt server retrieval without removing fallback behaviour.**

`retrieve_evidence_from_db` loads candidates through `rag_corpus`, ranks them through `rag_retrieval`, and returns backward-compatible evidence card fields plus score components and provenance. When PostgreSQL is unavailable, return an explicit retrieval status and retain only the existing frontend fallback for UI continuity. Do not silently use the 16-D legacy vector after the new path is present.

- [ ] **Step 4: Add a GET `/api/retrieval-trace` endpoint.**

Accept bounded `q` and `route` query parameters. Return candidates, final Top-5 and scoring metadata without calling DeepSeek or storing a chat turn.

- [ ] **Step 5: Run server-focused tests.**

Run: `.venv/bin/python -m unittest work.test_mia_response_structure work.test_server_keywords work.test_rag_retrieval -v`  
Expected: all tests pass.

### Task 5: Add Environment, Runbook And Full Regression Check

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `.env.example`
- Create: `docs/dfds-rag-foundation-runbook.md`

- [ ] **Step 1: Add dependency and configuration documentation.**

Pin `rank-bm25` to a compatible major version. Document optional embedding variables and state that missing credentials force lexical-only mode. Do not add real secrets.

- [ ] **Step 2: Document exact local commands.**

The runbook must use module-safe commands such as `PYTHONPATH=. .venv/bin/python backend/public_dataset_import.py --dry-run`, database start prerequisites, reindex command, evaluation command, expected `quality_gate_passed` interpretation and a clear warning that a green local test suite does not establish 90% Recall@5 without labelled held-out results.

- [ ] **Step 3: Run full test suite.**

Run: `.venv/bin/python -m unittest discover -s work -p 'test_*.py' -v`  
Expected: all tests pass.

- [ ] **Step 4: Run frontend build.**

Run: `pnpm build`  
Expected: Vite build exits 0. If `pnpm` dependencies are absent, record that as an environment prerequisite rather than changing unrelated frontend code.

## Deferred Work

- Model-backed cross-encoder: requires model selection, hosting, dependency and privacy approval.
- Production large-scale BM25 search service: requires a scale decision and deployment ownership.
- Authorised external review/API connectors: requires source contracts and credentials.
- Upload/dashboard UI: follows only after the retrieval trace API and evaluation output are stable.

## Self-Review

- Scope coverage: retrieval quality, evaluation, provenance, no-evidence behaviour and the server trace are covered in Tasks 1-5. Production ingestion, real connectors and the UI are explicitly deferred.
- No hidden claims: the plan never equates FTS with BM25 or claims 90% before the held-out run.
- Dependency consistency: `rank_bm25` is the sole new runtime ranking dependency; model-based reranking remains off by default.

# DFDS Integrated RAG Platform Design

**Date:** 2026-07-28  
**Status:** Proposed, user-approved architecture pending specification review

## Goal

Deliver an end-to-end DFDS customer and market intelligence RAG demonstration while establishing a measurable retrieval foundation. The primary quality target is `Recall@5 >= 0.90` on a frozen held-out evaluation set. The platform must show the full path from data intake through cleansing, PostgreSQL storage, indexing, retrieval, reranking, cited LLM response, and evaluation.

This design does not claim that public snapshots, synthetic records, or review-count snapshots are raw customer-review corpora.

## Success Metrics

| Metric | Definition | Target |
| --- | --- | --- |
| Recall@5 | At least one human-approved relevant evidence chunk appears in the first five returned chunks | >= 0.90 |
| MRR@10 | Reciprocal rank of the first relevant chunk, averaged across held-out questions | >= 0.75 |
| Citation correctness | Returned citation supports the asserted claim and has correct provenance | >= 0.99 |
| Correct abstention | Questions without sufficient evidence produce an explicit no-evidence response | >= 0.90 |
| Retrieval latency | P95 retrieval plus rerank time, excluding LLM generation | <= 1.0 second |

The benchmark contains at least 150 questions and is frozen before tuning. It must be stratified by English, Danish, Chinese, route, market/competitor query, data-analysis query, and no-evidence query. Development questions may tune the system; held-out questions may only evaluate it.

## Data Classes And Governance

| Class | Examples | Storage/use rules |
| --- | --- | --- |
| Public snapshot | Official route page, app-store aggregate, public article | Directional evidence only; retain URL and collection time |
| Licensed raw review | Approved API, business export, supplied CSV | Store raw payload separately, apply PII and retention controls, create auditable evidence chunks |
| Internal operational data | Booking, CRM, disruption events | Separate access namespace and policy; never surface without approved entitlement |
| Synthetic | Passenger profile and interview reviews | Always show synthetic label; test/demo use only; never support factual market claims |
| Evaluation | Question, expected evidence, judgement | Never index into the live retriever |

Every raw document and evidence chunk must include: immutable source identifier, source URL or origin, collection/published time, licence or authority, language, content hash, parser/chunker version, source tier, synthetic flag, and deletion/tombstone status.

## Architecture

```text
Authorised API / CSV / crawler cache
  -> raw intake (immutable payload and manifest)
  -> validation (schema, permission, PII, language, duplicate, freshness)
  -> normalisation and semantic chunking
  -> PostgreSQL evidence catalog + raw lineage + object storage payload
  -> lexical index (PostgreSQL FTS / BM25-equivalent)
     + semantic index (pgvector 1536-D)
  -> retrieve 50-100 candidates with route/source/time filters
  -> reciprocal-rank fusion
  -> cross-encoder rerank top 30 candidates
  -> top 5 cited chunks and confidence/abstention decision
  -> LLM grounded answer
  -> user-facing citations and provenance labels

Question and response traces
  -> evaluation persistence
  -> quality/latency/freshness dashboard
```

PostgreSQL remains the authoritative metadata and evidence store. Raw immutable payloads should move to object storage once source volume exceeds practical database JSONB storage. `raw_reviews` retains record-level lineage, while `evidence_items` contains queryable chunks linked by `raw_review_id` or a document lineage identifier.

## Retrieval Pipeline

1. Route the request as evidence, structured data, mixed, or insufficient-evidence.
2. Apply access, source-tier, route, language and freshness filters before ranking.
3. Run lexical search using PostgreSQL full-text ranking and a language-aware text configuration where supported.
4. Run cosine semantic search using populated `semantic_embedding vector(1536)`.
5. Retrieve 50-100 candidates from each search channel and combine them with reciprocal-rank fusion; do not compare raw BM25 and vector scores directly.
6. Apply a cross-encoder reranker to the top 30 fused candidates, using query plus chunk title/body/source context.
7. Return five chunks with evidence IDs, source, date, route, source tier, synthetic label, score components and raw lineage.
8. If no candidate passes the configured confidence/support threshold, return an explicit insufficient-evidence response instead of a factual answer.

The legacy 16-dimensional hash vector remains only during migration. It must not be used for the quality benchmark after the 1536-dimensional semantic corpus is available.

## End-To-End Demonstration

The demonstration includes the following visible, repeatable flow:

1. Select or upload an approved source manifest and raw file/cache.
2. Show validation outcomes: accepted, rejected, duplicate, PII-redacted, stale and synthetic records.
3. Show cleaned record count, chunk count, source-tier distribution and load status in PostgreSQL.
4. Trigger lexical/vector indexing and show corpus/index versions.
5. Ask a market or customer question and show retrieved candidates, reranking, final Top-5 sources, source labels and grounded answer.
6. Ask an unsupported question and show correct abstention.
7. Run the held-out evaluation and show Recall@5, MRR@10, citation correctness, abstention accuracy, P95 latency and per-segment breakdown.

The UI must not use an LLM answer as the evidence of retrieval quality. It must display the retrieved evidence and automated metric result independently.

## Delivery Stages

### Stage 1: Measurable Retrieval Foundation

- Freeze development and held-out evaluation sets.
- Implement provenance-normalised ingestion contract and direct CLI execution.
- Add PostgreSQL FTS, semantic embedding backfill, hybrid fusion and cross-encoder reranker.
- Build run persistence and metrics for each query.
- Gate: all quality metrics meet targets on the held-out set.

### Stage 2: End-To-End Demo

- Add operator flow for data intake, validation, import, indexing and status.
- Add Top-5 retrieval trace, citations, synthetic/public labels and abstention display.
- Add evaluation dashboard and reproducible demo script.
- Gate: a fresh local environment can run the complete flow from a versioned input fixture.

### Stage 3: Production Data And Operations

- Add authorised real-source connectors and incremental ingestion.
- Add object storage, data retention, PII controls, source permissions and audit logs.
- Add monitoring for ingestion errors, index freshness, model drift, metric regression and cost/latency.
- Gate: each source has a named owner, lawful basis/permission, refresh SLA and deletion procedure.

Stages may overlap, but Stage 2 cannot claim the quality target until Stage 1 has passed its held-out gate. Stage 3 does not unlock internal data automatically; access policy is enforced at retrieval time.

## Failure Handling

- Invalid/unauthorised input: quarantine it and record reason; do not index it.
- Missing embeddings: lexical-only mode is explicitly labelled; no semantic-quality claim is produced.
- Index update failure: preserve the last known-good index and expose corpus/index version mismatch.
- Query has no sufficient support: return abstention with the allowed next action, not an invented answer.
- Synthetic result matches a factual question: show synthetic label and exclude it as factual support unless the user explicitly requests demo data.
- Evaluation regression: block promotion and retain the comparison with the last accepted run.

## Scope Boundaries

- No arbitrary LLM-generated SQL against production data.
- No use of scraped or snapshot review counts as raw customer-comment volume.
- No test/evaluation question may be indexed as answer evidence.
- No production decision is based solely on a synthetic record or uncited LLM output.
- No source is ingested without recorded authority and provenance.

## Verification Plan

- Unit tests: cleaners, provenance, deduplication, chunking, filters, FTS query construction, fusion, reranker mapping and abstention.
- Integration tests: PostgreSQL schema/migration, indexing, import idempotency, retrieval trace and evaluation persistence.
- Regression tests: frozen held-out set must be run after every change to chunking, embeddings, ranking, model or corpus version.
- Operational checks: data freshness, failed-import count, missing embeddings, index coverage and source-tier leakage.

## Decision Record

The selected approach is an integrated quality-first plan. It delivers a credible end-to-end demonstration in Stage 2, but prioritises measured Top-5 retrieval and provenance safety in Stage 1. Real-data expansion is deliberately governed rather than treated as a generic scraping exercise.

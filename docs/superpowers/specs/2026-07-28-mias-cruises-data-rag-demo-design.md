# Mia's Cruises Data RAG Demo Design

## Goal

Build a demonstrable Mia's Cruises Passenger Ferry Customer Intelligence Data RAG using
only clearly labeled public snapshots and synthetic data. The demo must show
the distinction between evidence retrieval and structured-data analysis during
an interview without claiming access to real Mia's Cruises customer or operational data.

## Scope

The first release adds four capabilities to the existing Mia chat experience:

1. API-backed multilingual semantic embeddings and hybrid evidence retrieval.
2. Synthetic raw-review records with durable provenance and source labels.
3. A constrained, read-only Passenger Profile analytics tool for structured
   questions.
4. A repeatable RAG evaluation runner with citation and routing results.

The release does not ingest real customer data, execute arbitrary generated
SQL, hide synthetic provenance, or index the evaluation set as live knowledge.

## Architecture

```text
Chat question
  -> Intent router
     -> Evidence path: hybrid retrieval -> cited evidence
     -> Data path: allowlisted profile query -> computed metrics
     -> Mixed path: both paths -> combined answer context
  -> Existing chat model -> answer with source cards and data-query details
```

The existing DeepSeek chat integration remains the answer-generation layer.
Embeddings are supplied by a separate OpenAI-compatible embedding API so the
embedding provider can be changed without changing chat behavior.

## Embedding Provider

The backend exposes one embedding-provider boundary. Configuration uses:

```text
RAG_EMBEDDING_API_KEY=
RAG_EMBEDDING_BASE_URL=https://api.openai.com/v1
RAG_EMBEDDING_MODEL=text-embedding-3-small
RAG_EMBEDDING_DIMENSIONS=1536
```

The default model and dimension are deliberately fixed together. Changing the
model dimension requires a database migration and re-index instead of silently
mixing incompatible vectors.

The legacy `embedding vector(16)` column remains temporarily for compatibility.
New `semantic_embedding vector(1536)` columns become the source of semantic
ranking after a successful re-index. If the embedding API is unavailable, the
answer path still uses keyword retrieval and states that semantic retrieval is
unavailable; it must not fabricate vectors or claim a semantic match.

## Data Model

Evidence, insight, memory, and synthetic-review rows need explicit provenance.

| Entity | New data | Purpose |
| --- | --- | --- |
| `evidence_items` | `semantic_embedding`, `source_tier`, `is_synthetic`, `source_version` | Rank, filter, and label retrieved evidence. |
| `insight_items` | `semantic_embedding`, `is_synthetic` | Prevent synthetic conclusions from appearing as real findings. |
| `project_memories` | `semantic_embedding` | Reuse durable policies through the same embedding provider. |
| `raw_reviews` | `is_synthetic`, `source_version` | Store interview-demo review records before deriving evidence chunks. |
| `rag_evaluation_runs` / `rag_evaluation_results` | run configuration, retrieved IDs, route result, answer status, scores | Preserve reproducible evaluation evidence. |

Every synthetic record uses `source_tier = 'synthetic_demo'` and
`is_synthetic = true`. Public snapshot records use `source_tier =
'public_snapshot'`. The API response exposes these fields so the UI can label
them visibly.

## Synthetic Review Corpus

The demo creates a bounded, deterministic review corpus derived from the
existing Mia's Cruises themes, routes, app issues, and competitor context. Each review
has a stable `external_review_id`, route, language, rating, publication date,
and source version. The source name is `Synthetic Interview Review Corpus`.

The importer stores raw review rows first, then derives one or more evidence
chunks. This demonstrates the full lineage:

```text
Synthetic raw review -> normalized evidence chunk -> hybrid retrieval -> cited chat answer
```

The data generator does not imitate named customers or claim to be collected
from Trustpilot, Google, or another service.

## Hybrid Retrieval

Evidence retrieval ranks only allowed source tiers and combines:

1. PostgreSQL keyword/full-text score.
2. Cosine similarity over `semantic_embedding`.
3. Exact route boost.
4. Small source-quality and evidence-type boost.

Specific-route evidence ranks above `all`-route fallback evidence when both
match. The response preserves the evidence ID, source, route, source tier,
synthetic flag, and score components for evaluation and UI rendering.

The V3 50-question workbook remains an evaluation dataset. Its questions,
expected answers, and similar phrasings are not retrieved as answer evidence.

## Structured Data Tool

Passenger Profile analysis uses parameterized query templates, not arbitrary
text-to-SQL. The v1 allowlist contains these metrics:

| Query key | Result |
| --- | --- |
| `segment_by_route` | Passenger segment volume by route or route cluster. |
| `profile_by_route` | Demographic and journey profile for a route. |
| `product_preference` | Product preference and booking behavior by segment or route. |
| `spend_summary` | Average ticket, ancillary spend, and order value by route or segment. |

The intent router sends numeric/comparison questions to this tool, evidence and
policy questions to hybrid retrieval, and explanatory questions to both when
they contain a supported analytics dimension. Every data response includes its
query key, filters, row count, dataset label, and the statement `Synthetic
Passenger Profile`.

## Chat Response Contract

The existing `/api/chat` response is extended rather than replaced. In addition
to `answer`, `evidence`, `insights`, and `memories`, it may include:

```json
{
  "dataQuery": {
    "queryKey": "spend_summary",
    "datasetLabel": "Synthetic Passenger Profile",
    "filters": {"route": "North Sea overnight"},
    "rows": []
  },
  "retrieval": {
    "mode": "evidence|data|mixed",
    "semanticAvailable": true
  }
}
```

The existing chat widget renders evidence cards as it does today and adds a
compact Data Query block when `dataQuery` is present. Source cards show a
`Synthetic` label whenever `is_synthetic` is true.

## Evaluation

The existing 50 V3 questions become a development set. Each run records:

- evaluation key and input context;
- selected route and router mode;
- retrieved evidence IDs and data-query key;
- expected source coverage;
- answer availability and human score fields.

A new held-out fixture adds English, Danish, and Chinese questions. It is not
used for retrieval indexing. The runner reports retrieval availability,
expected-source coverage, exact-route rank, synthetic-source visibility, and
data-query correctness. It does not claim automated semantic answer correctness
where a human review is needed.

## Error Handling

- Missing embedding credentials: keyword-only retrieval with an explicit
  semantic-retrieval unavailable flag.
- Embedding request failure: no partial vector is stored; the failure is
  returned as an internal diagnostic only.
- Unsupported data request: no SQL runs; chat states which supported metric is
  available instead.
- Empty evidence result: chat says evidence is insufficient and avoids a
  source-backed claim.
- Unknown route: no route filter is applied until a supported route is chosen.

## Success Criteria

The interview demo is complete when it can show:

1. A cited hybrid-RAG answer with visible synthetic provenance.
2. A structured Passenger Profile answer produced by a constrained SQL query.
3. A mixed question that combines both kinds of context.
4. An evaluation run that records retrieved evidence and route decisions.
5. Passing automated tests for routing, source labels, query constraints,
   embedding fallback, and evaluation persistence.

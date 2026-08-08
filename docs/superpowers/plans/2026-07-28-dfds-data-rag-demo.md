# DFDS Data RAG Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interview-ready DFDS Data RAG demo that combines provenance-labelled evidence retrieval with constrained synthetic Passenger Profile analytics, while keeping all synthetic data visibly marked.

**Architecture:** Keep DeepSeek as the answer generator and add an OpenAI-compatible embedding boundary for semantic evidence retrieval. The backend will route each question to evidence retrieval, a parameterized Passenger Profile query, or both; all returned sources and metrics retain provenance. Evaluation data remains outside live retrieval and each evaluation run persists retrieval, route, provenance, and data-query results.

**Tech Stack:** Python 3.14 standard library HTTP client, psycopg 3, pgvector 0.8-compatible PostgreSQL, React 19, Vite 7, Python `unittest`, Node/Vite build tooling.

---

## Constraints To Preserve

- The demo uses only public snapshots and synthetic data. Never present an imported record as a real DFDS customer, booking, CRM, or operational record.
- `rag_evaluation_items` is evaluation input only. The live evidence retriever must never query it.
- Keep `embedding vector(16)` for compatibility. New semantic ranking uses only `semantic_embedding vector(1536)` after re-indexing.
- Do not call an embedding API when `RAG_EMBEDDING_API_KEY` is absent. The product must use keyword-only retrieval and set `retrieval.semanticAvailable` to `false`.
- Passenger Profile analysis is read-only and strictly allowlisted. User text must never be interpolated into SQL.
- This project has no Git repository. Do not add `git commit` commands or initialize Git as part of this work.

## Shared Interfaces

The following names are used consistently across all tasks.

| Module | Required public names |
| --- | --- |
| `backend/rag_embeddings.py` | `EmbeddingSettings`, `EmbeddingUnavailable`, `load_embedding_settings`, `embed_text`, `semantic_vector` |
| `backend/hybrid_retrieval.py` | `build_hybrid_evidence_query`, `rank_evidence_rows`, `normalize_evidence_row` |
| `backend/profile_data_queries.py` | `DATASET_LABEL`, `SUPPORTED_QUERY_KEYS`, `parse_data_request`, `build_query`, `execute_profile_query` |
| `backend/synthetic_interview_reviews.py` | `load_review_records`, `make_evidence_record`, `import_records` |
| `backend/rag_evaluation.py` | `build_evaluation_result`, `evaluation_result_upsert_sql`, `persist_evaluation_run` |

The `/api/chat` response keeps the existing keys and adds the following optional values:

```json
{
  "dataQuery": {
    "queryKey": "spend_summary",
    "datasetLabel": "Synthetic Passenger Profile",
    "filters": {"routeName": "Amsterdam-Newcastle"},
    "rows": []
  },
  "retrieval": {
    "mode": "evidence",
    "semanticAvailable": false
  }
}
```

## File Structure

- Create: `backend/rag_embeddings.py` - embedding configuration, HTTP client, vector validation, and provider-unavailable behavior.
- Create: `backend/hybrid_retrieval.py` - parameterized hybrid evidence SQL construction and response-row normalization.
- Create: `backend/profile_data_queries.py` - intent parsing and four read-only Passenger Profile SQL templates.
- Create: `backend/synthetic_interview_reviews.py` - deterministic raw-review corpus generator and raw-review-to-evidence importer.
- Create: `backend/rag_evaluation.py` - evaluation result scoring and PostgreSQL persistence helpers.
- Create: `data/synthetic_interview_reviews.json` - fixed multilingual synthetic review source records with stable IDs and source version.
- Create: `work/reindex_rag_embeddings.py` - explicit, opt-in semantic embedding backfill CLI.
- Create: `work/run_data_rag_evaluation.py` - development/held-out evaluation runner and JSON report output.
- Create: `work/dfds_rag_heldout.json` - non-indexed English, Danish, and Chinese held-out evaluation cases.
- Create: `work/test_rag_embeddings.py` - embedding configuration, HTTP request, invalid vector, and unavailable-provider tests.
- Create: `work/test_hybrid_retrieval.py` - SQL parameterization, route preference, score components, and provenance tests.
- Create: `work/test_profile_data_queries.py` - router, allowlist, parameter binding, and unsupported-request tests.
- Create: `work/test_synthetic_interview_reviews.py` - deterministic corpus and raw-to-evidence lineage tests.
- Create: `work/test_rag_evaluation.py` - evaluation metric and persistence tests.
- Create: `docs/dfds-data-rag-demo-runbook.md` - local setup, demo flow, reindex, and evaluation commands.
- Modify: `db/schema.sql` - semantic/provenance columns, raw-review lineage, and evaluation-run/result tables.
- Modify: `server.py` - hybrid retrieval, data routing, answer context, response contract, and chat-turn audit context.
- Modify: `backend/public_dataset_import.py` - explicitly set provenance values for newly imported evidence rows.
- Modify: `app/scripts/services/chat-api.mjs` - pass `dataQuery` and `retrieval` through the frontend service.
- Modify: `app/components/chat-widget.jsx` - render returned source provenance and compact data-query output.
- Modify: `app/styles.css` - source label and data-query layout, including mobile constraints.
- Modify: `work/test_mia_response_structure.py` - assert response context and fallback behavior for data and provenance.
- Modify: `work/test_chat_widget_source.py` - assert data-query and synthetic-label rendering contract.
- Modify: `.env.example` - document embedding configuration without a real key.
- Modify: `docker-compose.yml` - pass optional embedding configuration into the app container.
- Modify: `dfds-customer-insights-logs/2026-07-28.md` - record the implementation and verification result.

### Task 1: Add the Schema Contract Before Backend Code

**Files:**
- Modify: `db/schema.sql:36-188`
- Create: `work/test_data_rag_schema.py`

- [ ] **Step 1: Write failing schema-contract tests.**

```python
class DataRagSchemaTests(unittest.TestCase):
    def test_schema_keeps_legacy_and_adds_1536_dimension_semantic_vectors(self):
        schema = SCHEMA_PATH.read_text(encoding="utf-8")
        self.assertIn("embedding vector(16)", schema)
        self.assertIn("semantic_embedding vector(1536)", schema)

    def test_schema_persists_evidence_provenance_and_raw_review_lineage(self):
        schema = SCHEMA_PATH.read_text(encoding="utf-8")
        for fragment in (
            "source_tier TEXT NOT NULL DEFAULT 'public_snapshot'",
            "is_synthetic BOOLEAN NOT NULL DEFAULT FALSE",
            "source_version TEXT NOT NULL DEFAULT 'legacy-v1'",
            "raw_review_id BIGINT REFERENCES raw_reviews(id) ON DELETE SET NULL",
        ):
            self.assertIn(fragment, schema)

    def test_schema_has_reproducible_evaluation_run_and_result_tables(self):
        schema = SCHEMA_PATH.read_text(encoding="utf-8")
        self.assertIn("CREATE TABLE IF NOT EXISTS rag_evaluation_runs", schema)
        self.assertIn("CREATE TABLE IF NOT EXISTS rag_evaluation_results", schema)
        self.assertIn("UNIQUE (run_id, evaluation_key)", schema)
```

- [ ] **Step 2: Run the test and confirm it fails because the semantic/provenance contract is absent.**

Run: `python3 work/test_data_rag_schema.py`

Expected: `FAIL` assertions for `semantic_embedding`, provenance columns, and evaluation tables.

- [ ] **Step 3: Extend the schema with idempotent migrations.**

Add the following columns after the affected tables have been created. Keep the existing `embedding vector(16)` columns untouched. Add the `raw_review_id` foreign key only after the `raw_reviews` table definition, because PostgreSQL cannot reference a table before it exists.

```sql
ALTER TABLE evidence_items
  ADD COLUMN IF NOT EXISTS semantic_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS source_tier TEXT NOT NULL DEFAULT 'public_snapshot',
  ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_version TEXT NOT NULL DEFAULT 'legacy-v1';

ALTER TABLE insight_items
  ADD COLUMN IF NOT EXISTS semantic_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE project_memories
  ADD COLUMN IF NOT EXISTS semantic_embedding vector(1536);

ALTER TABLE raw_reviews
  ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_version TEXT NOT NULL DEFAULT 'legacy-v1';

ALTER TABLE evidence_items
  ADD COLUMN IF NOT EXISTS raw_review_id BIGINT REFERENCES raw_reviews(id) ON DELETE SET NULL;

UPDATE evidence_items
SET source_tier = 'synthetic_demo', is_synthetic = TRUE
WHERE metadata->>'synthetic_source' = 'true'
   OR metadata->>'synthetic' = 'true'
   OR source_id IN (SELECT id FROM sources WHERE source_key LIKE 'synthetic-%');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_items_source_tier_check'
  ) THEN
    ALTER TABLE evidence_items
      ADD CONSTRAINT evidence_items_source_tier_check
      CHECK (source_tier IN ('public_snapshot', 'synthetic_demo'));
  END IF;
END $$;
```

Create the two evaluation tables with this exact contract. `human_score` and `human_notes` are deliberately nullable because the runner records retrieval facts, not an automated claim of answer correctness.

```sql
CREATE TABLE IF NOT EXISTS rag_evaluation_runs (
  id BIGSERIAL PRIMARY KEY,
  run_key TEXT NOT NULL UNIQUE,
  evaluation_set TEXT NOT NULL CHECK (evaluation_set IN ('development', 'heldout', 'all')),
  embedding_model TEXT NOT NULL,
  embedding_dimensions INTEGER NOT NULL,
  retrieval_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS rag_evaluation_results (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES rag_evaluation_runs(id) ON DELETE CASCADE,
  evaluation_key TEXT NOT NULL,
  question TEXT NOT NULL,
  input_language TEXT NOT NULL,
  selected_route TEXT NOT NULL,
  retrieval_mode TEXT NOT NULL CHECK (retrieval_mode IN ('evidence', 'data', 'mixed')),
  retrieved_evidence_ids BIGINT[] NOT NULL DEFAULT '{}'::BIGINT[],
  data_query_key TEXT,
  semantic_available BOOLEAN NOT NULL,
  expected_source_covered BOOLEAN,
  exact_route_rank INTEGER,
  synthetic_source_visible BOOLEAN NOT NULL,
  answer_available BOOLEAN NOT NULL,
  human_score NUMERIC(3, 1) CHECK (human_score IS NULL OR (human_score >= 0 AND human_score <= 5)),
  human_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, evaluation_key)
);

CREATE INDEX IF NOT EXISTS idx_rag_evaluation_results_run
  ON rag_evaluation_results (run_id, evaluation_key);
```

```sql
CREATE INDEX IF NOT EXISTS idx_evidence_semantic_embedding
  ON evidence_items USING hnsw (semantic_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_evidence_provenance
  ON evidence_items (source_tier, is_synthetic, source_version);
CREATE INDEX IF NOT EXISTS idx_evidence_raw_review
  ON evidence_items (raw_review_id);
```

Use a `CHECK (source_tier IN ('public_snapshot', 'synthetic_demo'))` constraint for new evidence rows. The migration must preserve existing public rows through the default value rather than deleting or reloading them.

- [ ] **Step 4: Re-run the schema test and confirm it passes.**

Run: `python3 work/test_data_rag_schema.py`

Expected: `OK`.

- [ ] **Step 5: Apply the schema once against the local database when it is available.**

Run: `DATABASE_URL=postgresql://dfds:dfds@127.0.0.1:5432/dfds python3 -c "import server; conn=server.connect_db(register=False); server.execute_schema(conn); conn.close()"`

Expected: exit code `0`; rerunning the command is idempotent.

### Task 2: Implement the Embedding Boundary and Explicit Reindexing

**Files:**
- Create: `backend/rag_embeddings.py`
- Create: `work/reindex_rag_embeddings.py`
- Create: `work/test_rag_embeddings.py`
- Modify: `.env.example`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Write failing embedding tests.**

```python
import json
import unittest
import urllib.error

from backend import rag_embeddings

class FakeResponse:
    def __init__(self, payload):
        self.payload = payload
        self.request = None

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")

class FakeUrlOpen:
    def __init__(self, response):
        self.response = response

    def __call__(self, request, **_kwargs):
        self.response.request = request
        return self.response

class EmbeddingTests(unittest.TestCase):
    def test_missing_api_key_disables_semantic_retrieval_without_network(self):
        self.assertIsNone(rag_embeddings.load_embedding_settings({}))

    def test_settings_reject_dimension_that_does_not_match_schema(self):
        with self.assertRaisesRegex(ValueError, "1536"):
            rag_embeddings.load_embedding_settings({
                "RAG_EMBEDDING_API_KEY": "test-key",
                "RAG_EMBEDDING_DIMENSIONS": "1024",
            })

    def test_embed_text_posts_openai_compatible_payload_and_validates_length(self):
        settings = rag_embeddings.EmbeddingSettings("test-key", "https://embed.example/v1", "text-embedding-3-small", 1536)
        response = FakeResponse({"data": [{"embedding": [0.0] * 1536}]})
        vector = rag_embeddings.embed_text("Dover delay guidance", settings, urlopen=FakeUrlOpen(response))
        self.assertEqual(len(vector), 1536)
        self.assertEqual(response.request.full_url, "https://embed.example/v1/embeddings")
        self.assertNotIn("test-key", response.request.data.decode("utf-8"))

    def test_embed_text_rejects_partial_vectors(self):
        settings = rag_embeddings.EmbeddingSettings("test-key", "https://embed.example/v1", "text-embedding-3-small", 1536)
        with self.assertRaisesRegex(ValueError, "expected 1536"):
            rag_embeddings.embed_text("x", settings, urlopen=FakeUrlOpen(FakeResponse({"data": [{"embedding": [0.0]}]})))

    def test_network_failure_is_explicitly_unavailable_not_a_fake_vector(self):
        settings = rag_embeddings.EmbeddingSettings("test-key", "https://embed.example/v1", "text-embedding-3-small", 1536)
        with self.assertRaises(rag_embeddings.EmbeddingUnavailable):
            rag_embeddings.embed_text("x", settings, urlopen=lambda *_args, **_kwargs: (_ for _ in ()).throw(urllib.error.URLError("offline")))
```

- [ ] **Step 2: Run the test and confirm the module import fails.**

Run: `python3 work/test_rag_embeddings.py`

Expected: `ModuleNotFoundError: No module named 'backend.rag_embeddings'`.

- [ ] **Step 3: Implement a small OpenAI-compatible provider boundary.**

Implement `load_embedding_settings` with these defaults and the fixed-dimension guard:

```python
DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "text-embedding-3-small"
SCHEMA_EMBEDDING_DIMENSIONS = 1536

def load_embedding_settings(environ=None):
    values = os.environ if environ is None else environ
    api_key = str(values.get("RAG_EMBEDDING_API_KEY", "")).strip()
    if not api_key:
        return None
    dimensions = int(values.get("RAG_EMBEDDING_DIMENSIONS", SCHEMA_EMBEDDING_DIMENSIONS))
    if dimensions != SCHEMA_EMBEDDING_DIMENSIONS:
        raise ValueError("RAG_EMBEDDING_DIMENSIONS must be 1536 until a schema migration and re-index are completed")
    return EmbeddingSettings(
        api_key=api_key,
        base_url=str(values.get("RAG_EMBEDDING_BASE_URL", DEFAULT_BASE_URL)).rstrip("/"),
        model=str(values.get("RAG_EMBEDDING_MODEL", DEFAULT_MODEL)),
        dimensions=dimensions,
    )
```

`embed_text` must POST JSON `{"input": text, "model": settings.model, "dimensions": settings.dimensions}` to `/embeddings`, use the Bearer token only in the `Authorization` header, and require one finite numeric vector with exactly 1,536 values. Raise `EmbeddingUnavailable` for HTTP/network/provider failures; do not return a fabricated vector.

Implement `work/reindex_rag_embeddings.py` with `--entity evidence|insights|memories|all`, `--batch-size`, `--limit`, `--force`, and `--dry-run`. It must:

```python
for row in rows:
    vector = rag_embeddings.embed_text(make_embedding_text(row), settings)
    cur.execute(
        f"UPDATE {table_name} SET semantic_embedding = %s WHERE id = %s",
        (rag_embeddings.semantic_vector(vector), row["id"]),
    )
```

Use only table names from the constant mapping `{"evidence": "evidence_items", "insights": "insight_items", "memories": "project_memories"}`. Commit only after every successfully embedded batch; an embedding exception must roll back the current batch so no partial vector is written.

- [ ] **Step 4: Document, but do not populate, optional embedding credentials.**

Append these empty settings to `.env.example` and pass the same values through the `app` service in `docker-compose.yml`:

```dotenv
RAG_EMBEDDING_API_KEY=
RAG_EMBEDDING_BASE_URL=https://api.openai.com/v1
RAG_EMBEDDING_MODEL=text-embedding-3-small
RAG_EMBEDDING_DIMENSIONS=1536
```

Do not add a real key to any project file.

- [ ] **Step 5: Re-run the unit test and validate dry-run behavior without a key.**

Run: `python3 work/test_rag_embeddings.py`

Expected: `OK`.

Run: `python3 work/reindex_rag_embeddings.py --entity evidence --dry-run`

Expected: a clear `RAG_EMBEDDING_API_KEY is not configured` failure before any database update.

### Task 3: Add Deterministic Synthetic Raw Reviews With Durable Lineage

**Files:**
- Create: `data/synthetic_interview_reviews.json`
- Create: `backend/synthetic_interview_reviews.py`
- Create: `work/test_synthetic_interview_reviews.py`
- Modify: `backend/public_dataset_import.py:586-676`

- [ ] **Step 1: Write failing corpus and lineage tests.**

```python
class RecordingCursor:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def execute(self, sql, _params=None):
        normalized = " ".join(sql.split()).lower()
        if "insert into raw_reviews" in normalized:
            self.connection.executed_tables.append("raw_reviews")
        if "insert into evidence_items" in normalized:
            self.connection.executed_tables.append("evidence_items")
        return self

    def fetchone(self):
        return {"id": 91}

class FakeConnection:
    def __init__(self):
        self.executed_tables = []

    def cursor(self):
        return RecordingCursor(self)

    def commit(self):
        return None

class SyntheticInterviewReviewTests(unittest.TestCase):
    def test_fixed_corpus_has_stable_ids_multilingual_examples_and_visible_provenance(self):
        records = importer.load_review_records()
        self.assertGreaterEqual(len(records), 12)
        self.assertEqual(records[0]["external_review_id"], "sir-0001")
        self.assertEqual({row["language"] for row in records}, {"en", "da", "zh"})
        self.assertTrue(all(row["is_synthetic"] for row in records))
        self.assertTrue(all(row["source_version"] == "2026-07-28" for row in records))

    def test_evidence_chunk_retains_raw_review_lineage_and_demo_tier(self):
        review = importer.load_review_records()[0]
        evidence = importer.make_evidence_record(review, raw_review_id=91)
        self.assertEqual(evidence["source_tier"], "synthetic_demo")
        self.assertTrue(evidence["is_synthetic"])
        self.assertEqual(evidence["raw_review_id"], 91)
        self.assertEqual(evidence["metadata"]["raw_review_external_id"], "sir-0001")
        self.assertIn("Synthetic Interview Review Corpus", evidence["source_name"])

    def test_importer_upserts_raw_reviews_before_evidence(self):
        conn = FakeConnection()
        importer.import_records(conn, importer.load_review_records()[:1])
        self.assertEqual(conn.executed_tables[:2], ["raw_reviews", "evidence_items"])
```

- [ ] **Step 2: Run the test and confirm it fails because the importer is missing.**

Run: `python3 work/test_synthetic_interview_reviews.py`

Expected: `ModuleNotFoundError: No module named 'backend.synthetic_interview_reviews'`.

- [ ] **Step 3: Create the fixed interview corpus.**

Create 12 records in `data/synthetic_interview_reviews.json`: four English, four Danish, and four Chinese. Use `external_review_id` values `sir-0001` through `sir-0012`; source name `Synthetic Interview Review Corpus`; source version `2026-07-28`; and a route mix covering `dover-calais`, `newhaven-dieppe`, `newcastle-ijmuiden`, `jersey`, and `all`. Include only fictional wording about the known demo themes: app login/booking, route guidance, delay communication, cabin/onboard experience, and recovery messaging. Do not use personal names, copied review text, or claims that a third-party site collected the records.

Each record must have this shape:

```json
{
  "external_review_id": "sir-0001",
  "route_key": "dover-calais",
  "language": "en",
  "rating": 2.0,
  "published_at": "2026-07-01T09:00:00+00:00",
  "title": "Synthetic delay guidance scenario",
  "review_text": "Fictional interview-demo wording about needing clearer arrival guidance.",
  "themes": ["delay_guidance", "border_control"],
  "is_synthetic": true,
  "source_version": "2026-07-28"
}
```

- [ ] **Step 4: Implement raw-review-first import.**

`backend/synthetic_interview_reviews.py` must define `import_records(conn, records)` as the reusable import body used by the CLI. It loads the JSON file, validates the required fields, inserts/updates a source with key `synthetic-interview-review-corpus`, and uses this order per record:

```sql
INSERT INTO raw_reviews (
  source_id, company_id, external_review_id, title, review_text, rating,
  language, published_at, metadata, raw_json, is_synthetic, source_version
)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, TRUE, %s)
ON CONFLICT (source_id, external_review_id) DO UPDATE
SET title = EXCLUDED.title,
    review_text = EXCLUDED.review_text,
    rating = EXCLUDED.rating,
    language = EXCLUDED.language,
    published_at = EXCLUDED.published_at,
    metadata = EXCLUDED.metadata,
    raw_json = EXCLUDED.raw_json,
    is_synthetic = TRUE,
    source_version = EXCLUDED.source_version
RETURNING id;
```

Build one evidence record from each raw review. Its `metadata` must include `raw_review_external_id`, `synthetic_source: true`, `source_tier: synthetic_demo`, `source_version`, `language`, and `themes`. Insert it with the returned `raw_review_id`, explicit `source_tier = 'synthetic_demo'`, `is_synthetic = TRUE`, and `source_version`. Do not request embeddings during this import; semantic vectors are populated by the explicit reindex command.

Add `--replace` to delete only this corpus's evidence and raw reviews by the fixed source key, then reinsert the same deterministic records. Add `--dry-run` to print record count and the first normalized record without opening a database connection.

Update `backend/public_dataset_import.py` so its evidence upsert has `source_tier`, `is_synthetic`, and `source_version` columns. Derive their values only from `record["source_tier"]`, `record["is_synthetic"]`, `record["source_version"]`, or existing synthetic metadata; default public records to `public_snapshot`, `False`, and `legacy-v1`.

- [ ] **Step 5: Run importer and provenance tests.**

Run: `python3 work/test_synthetic_interview_reviews.py`

Expected: `OK`.

Run: `python3 backend/synthetic_interview_reviews.py --dry-run`

Expected: JSON containing `records: 12`, `source_name: "Synthetic Interview Review Corpus"`, and no database writes.

### Task 4: Replace Hash-Vector Evidence Ranking With Hybrid Retrieval

**Files:**
- Create: `backend/hybrid_retrieval.py`
- Create: `work/test_hybrid_retrieval.py`
- Modify: `server.py:1287-1376`
- Modify: `server.py:1540-1574`

- [ ] **Step 1: Write failing hybrid retrieval tests.**

```python
class HybridRetrievalTests(unittest.TestCase):
    def test_query_uses_bound_term_parameters_and_never_inlines_user_text(self):
        sql, params = retrieval.build_hybrid_evidence_query(
            ["dover", "x'; DROP TABLE evidence_items; --"], "dover-calais", False, 6
        )
        self.assertNotIn("DROP TABLE", sql)
        self.assertEqual(params["term_1"], "%x'; drop table evidence_items; --%")
        self.assertIn("source_tier = ANY(%(allowed_source_tiers)s)", sql)

    def test_exact_route_outranks_all_route_fallback_when_scores_are_equal(self):
        ranked = retrieval.rank_evidence_rows([
            {"id": 1, "route_key": "all", "keyword_score": 2, "semantic_score": 0.8, "source_tier": "public_snapshot", "evidence_kind": "app_review"},
            {"id": 2, "route_key": "dover-calais", "keyword_score": 2, "semantic_score": 0.8, "source_tier": "public_snapshot", "evidence_kind": "app_review"},
        ], "dover-calais")
        self.assertEqual(ranked[0]["id"], 2)
        self.assertGreater(ranked[0]["scoreComponents"]["routeBoost"], 0)

    def test_keyword_only_mode_returns_zero_semantic_score_and_visible_provenance(self):
        row = retrieval.normalize_evidence_row({
            "id": 3, "source_tier": "synthetic_demo", "is_synthetic": True,
            "source_version": "2026-07-28", "semantic_score": 0.0,
        })
        self.assertEqual(row["sourceTier"], "synthetic_demo")
        self.assertTrue(row["isSynthetic"])
        self.assertEqual(row["sourceVersion"], "2026-07-28")
```

- [ ] **Step 2: Run the test and confirm the module import fails.**

Run: `python3 work/test_hybrid_retrieval.py`

Expected: `ModuleNotFoundError: No module named 'backend.hybrid_retrieval'`.

- [ ] **Step 3: Implement safe hybrid SQL construction and deterministic scoring.**

`build_hybrid_evidence_query` must build only parameter names from term positions. It must select `keyword_score`, `semantic_score`, `route_boost`, `source_boost`, `type_boost`, and `hybrid_score`, filter `source_tier` to `['public_snapshot', 'synthetic_demo']`, and bind every user-derived value.

Use the following formula in Python for final ordering after PostgreSQL returns candidates:

```python
def score_components(row, requested_route):
    route_boost = 0.16 if row.get("route_key") == requested_route else 0.04 if row.get("route_key") == "all" else 0.0
    source_boost = 0.08 if row.get("source_tier") == "public_snapshot" else 0.03
    type_boost = 0.04 if row.get("evidence_kind") in {"app_review", "raw_review_chunk"} else 0.0
    keyword_score = min(float(row.get("keyword_score") or 0.0) / 6.0, 1.0)
    semantic_score = max(float(row.get("semantic_score") or 0.0), 0.0)
    return {
        "keywordScore": round(keyword_score, 4),
        "semanticScore": round(semantic_score, 4),
        "routeBoost": route_boost,
        "sourceBoost": source_boost,
        "typeBoost": type_boost,
        "hybridScore": round(keyword_score * 0.35 + semantic_score * 0.55 + route_boost + source_boost + type_boost, 4),
    }
```

When no semantic vector is available, the SQL must use `0.0 AS semantic_score` and not reference `%(semantic_embedding)s`. When a vector is available, use `1 - (e.semantic_embedding <=> %(semantic_embedding)s)`; do not fall back to the legacy hash embedding for semantic ranking.

- [ ] **Step 4: Integrate the hybrid retriever into `server.py`.**

Import `rag_embeddings` and `hybrid_retrieval`. In `retrieve_evidence_from_db`:

1. Load settings and call `embed_text` for the query only if settings are present.
2. Catch `EmbeddingUnavailable` and continue with keyword-only SQL, recording `semantic_available = False` internally.
3. Build the SQL from `query_terms`, execute it with bound parameters, normalize/rank/dedupe candidate rows, and return the provenance and `scoreComponents` fields.
4. Treat an unrecognized `routeKey` as no route filter, rather than forcing a non-matching `WHERE` clause.

Return retrieval status with evidence using this internal shape:

```python
{
    "items": ranked_items,
    "semanticAvailable": semantic_available,
}
```

Change `build_rag_context` to store `retrieval` separately while retaining `evidenceItems` for current callers. Extend `compact_evidence` to include `source_tier`, `is_synthetic`, `source_version`, and `score_components` under camel-case response keys. Do not add `rag_evaluation_items` to any live SQL query.

- [ ] **Step 5: Run focused tests and preserve legacy keyword behavior.**

Run: `python3 work/test_hybrid_retrieval.py && python3 work/test_server_keywords.py`

Expected: both test modules report `OK`.

### Task 5: Add a Read-Only Passenger Profile Data Tool

**Files:**
- Create: `backend/profile_data_queries.py`
- Create: `work/test_profile_data_queries.py`
- Modify: `server.py:1632-1647`

- [ ] **Step 1: Write failing data-query tests.**

```python
class ProfileDataQueryTests(unittest.TestCase):
    def test_router_maps_spend_question_to_allowlisted_query_and_known_route(self):
        request = queries.parse_data_request(
            "What is average ticket and ancillary spend for Newcastle-IJmuiden?", "newcastle-ijmuiden"
        )
        self.assertEqual(request["queryKey"], "spend_summary")
        self.assertEqual(request["filters"], {"routeName": "Amsterdam-Newcastle"})

    def test_router_supports_chinese_and_danish_profile_questions(self):
        self.assertEqual(queries.parse_data_request("北海夜航哪些客群最多？", "all")["queryKey"], "segment_by_route")
        self.assertEqual(queries.parse_data_request("Hvilke produkter foretraekker familier?", "all")["queryKey"], "product_preference")

    def test_unknown_or_freeform_sql_request_executes_no_sql(self):
        self.assertIsNone(queries.parse_data_request("run SELECT * FROM pg_catalog", "all"))

    def test_query_templates_bind_filter_values(self):
        request = {"queryKey": "spend_summary", "filters": {"routeName": "x'; DROP TABLE dfds_profile.fact_passenger_trips; --"}}
        sql, params = queries.build_query(request)
        self.assertNotIn("DROP TABLE", sql)
        self.assertEqual(params["route_name"], "x'; DROP TABLE dfds_profile.fact_passenger_trips; --")
```

- [ ] **Step 2: Run the test and confirm it fails because the query module is missing.**

Run: `python3 work/test_profile_data_queries.py`

Expected: `ModuleNotFoundError: No module named 'backend.profile_data_queries'`.

- [ ] **Step 3: Define the router and all four static SQL templates.**

Recognize numeric/profile vocabulary in English, Danish, and Chinese. Return only one of the four query keys or `None`. Resolve dashboard aliases to actual synthetic profile values:

```python
ROUTE_ALIASES = {
    "dover-calais": {"routeName": "Calais-Dover"},
    "newhaven-dieppe": {"routeName": "Dieppe-Newhaven"},
    "newcastle-ijmuiden": {"routeName": "Amsterdam-Newcastle"},
    "jersey": {"routeCluster": "celtic_short_break"},
}
```

Use `dfds_profile.v_clean_passenger_trips` in every template and select only aggregates. For example, `spend_summary` must be:

```sql
SELECT
  route_cluster,
  route_name,
  segment_label,
  COUNT(*) AS trip_count,
  ROUND(AVG(ticket_price), 2) AS avg_ticket_price,
  ROUND(AVG(ancillary_spend), 2) AS avg_ancillary_spend,
  ROUND(AVG(total_order_value), 2) AS avg_order_value
FROM dfds_profile.v_clean_passenger_trips
WHERE (%(route_name)s::text IS NULL OR route_name = %(route_name)s)
  AND (%(route_cluster)s::text IS NULL OR route_cluster = %(route_cluster)s)
  AND (%(segment_label)s::text IS NULL OR segment_label = %(segment_label)s)
GROUP BY route_cluster, route_name, segment_label
ORDER BY avg_order_value DESC, trip_count DESC
LIMIT 12
```

`segment_by_route` groups by route and `segment_label`; `profile_by_route` groups by route, `age_group`, `travel_purpose`, and `party_type`; `product_preference` groups by route, segment, product category/name, and booking channel. The builder may add only schema-owned SQL fragments for the three filter fields. It must never accept a table name, column name, order-by clause, or SQL text from the message.

`execute_profile_query` must return this exact response shape after a parameterized `cur.execute(sql, params)`:

```python
{
    "queryKey": request["queryKey"],
    "datasetLabel": DATASET_LABEL,
    "filters": request["filters"],
    "rows": rows,
    "rowCount": len(rows),
}
```

For unavailable database/profile schema, return no rows and a server-side diagnostic; do not run a fallback SQL statement.

- [ ] **Step 4: Route data and mixed questions in `build_rag_context`.**

Add `classify_retrieval_mode(message, data_request)` with output `evidence`, `data`, or `mixed`. A numeric or segment/profile question is `data`; it is `mixed` only when it also asks for evidence, explanation, risk, recommendation, or root cause. Run evidence retrieval for `evidence` and `mixed`, run `execute_profile_query` for `data` and `mixed`, and include both in the returned context:

```python
{
    "evidenceItems": evidence_items,
    "dataQuery": data_query,
    "retrieval": {"mode": retrieval_mode, "semanticAvailable": semantic_available},
}
```

For an unsupported data request, add `supportedDataQueryKeys: list(SUPPORTED_QUERY_KEYS)` to the private answer context and execute no SQL.

- [ ] **Step 5: Re-run the tests.**

Run: `python3 work/test_profile_data_queries.py && python3 work/test_passenger_profile_import.py`

Expected: both test modules report `OK`.

### Task 6: Extend Chat Answering and API Responses Without Breaking Existing Modes

**Files:**
- Modify: `server.py:1540-1574`
- Modify: `server.py:2040-2168`
- Modify: `server.py:2178-2230`
- Modify: `work/test_mia_response_structure.py`

- [ ] **Step 1: Add failing response-contract tests.**

```python
def test_call_deepseek_returns_data_query_and_retrieval_metadata_without_api_key(self):
    rag_context = {
        "evidenceItems": [], "insightItems": [], "memoryItems": [],
        "dataQuery": {"queryKey": "spend_summary", "datasetLabel": "Synthetic Passenger Profile", "filters": {}, "rows": [{"avg_order_value": 221.4}], "rowCount": 1},
        "retrieval": {"mode": "data", "semanticAvailable": False},
    }
    with patch.dict("os.environ", {}, clear=True):
        status, response = server.call_deepseek({"message": "What is the average spend?", "language": "English"}, rag_context)
    self.assertEqual(status, 200)
    self.assertEqual(response["dataQuery"]["datasetLabel"], "Synthetic Passenger Profile")
    self.assertEqual(response["retrieval"]["mode"], "data")

def test_compact_evidence_exposes_synthetic_provenance(self):
    item = server.compact_evidence([{"id": 8, "sourceTier": "synthetic_demo", "isSynthetic": True, "sourceVersion": "2026-07-28"}])[0]
    self.assertTrue(item["isSynthetic"])
    self.assertEqual(item["sourceTier"], "synthetic_demo")

def test_empty_evidence_mode_states_insufficient_evidence(self):
    rag_context = {
        "evidenceItems": [], "insightItems": [], "memoryItems": [], "dataQuery": None,
        "retrieval": {"mode": "evidence", "semanticAvailable": False},
    }
    with patch.dict("os.environ", {}, clear=True):
        _status, response = server.call_deepseek({"message": "What is the route risk?", "language": "English"}, rag_context)
    self.assertIn("evidence is insufficient", response["answer"].lower())
```

- [ ] **Step 2: Run the focused test and confirm it fails on missing keys.**

Run: `python3 work/test_mia_response_structure.py`

Expected: `FAIL` because current response has no `dataQuery`, `retrieval`, or camel-case provenance keys.

- [ ] **Step 3: Add data-aware prompt context and deterministic no-key fallback.**

Extend `build_messages` to serialize `dataQuery` and `retrieval` and add these exact guardrails to the system prompt:

```text
Passenger Profile values are synthetic interview-demo data, not real DFDS CRM, booking, or operational facts.
When a data query is supplied, state the result as Synthetic Passenger Profile and do not invent a metric that is absent from its rows.
When semanticAvailable is false, do not claim a semantic match.
```

Pass `dataQuery` in the user context after evidence. Add `insufficient_evidence_answer(payload)` and use it when `retrieval.mode` is `evidence` or `mixed` but both evidence and data results are absent; it must state that the available evidence is insufficient and must not make a source-backed claim. Keep `bridge_answer` only for non-report/smalltalk turns. Add `data_only_answer(payload, data_query, reason)` for no-DeepSeek execution; it must name `Synthetic Passenger Profile`, include at most the first three rows, and not claim factual validation outside the demo dataset.

Every successful vertical response, smalltalk response, no-evidence response, no-key response, and DeepSeek response must include:

```python
"dataQuery": rag_context.get("dataQuery"),
"retrieval": rag_context.get("retrieval", {"mode": "evidence", "semanticAvailable": False}),
```

Store `dataQuery` and `retrieval` in `chat_messages.evidence_context` together with compacted evidence, not in `page_context`. Keep the existing response keys and answer-cleaning behavior unchanged.

- [ ] **Step 4: Re-run the backend response tests.**

Run: `python3 work/test_mia_response_structure.py && python3 work/test_server_keywords.py`

Expected: both test modules report `OK`.

### Task 7: Build a Repeatable, Non-Indexed Evaluation Runner

**Files:**
- Create: `backend/rag_evaluation.py`
- Create: `work/dfds_rag_heldout.json`
- Create: `work/run_data_rag_evaluation.py`
- Create: `work/test_rag_evaluation.py`
- Modify: `db/schema.sql`

- [ ] **Step 1: Write failing evaluation tests.**

```python
class RagEvaluationTests(unittest.TestCase):
    def test_result_records_route_data_query_provenance_and_visibility(self):
        result = evaluation.build_evaluation_result(
            {"evaluation_key": "heldout-zh-spend", "expectedDataQueryKey": "spend_summary", "route_focus": "newcastle-ijmuiden"},
            {"evidenceItems": [{"id": 9, "routeKey": "newcastle-ijmuiden", "isSynthetic": True}],
             "dataQuery": {"queryKey": "spend_summary"},
             "retrieval": {"mode": "mixed", "semanticAvailable": False}},
        )
        self.assertEqual(result["data_query_key"], "spend_summary")
        self.assertEqual(result["exact_route_rank"], 1)
        self.assertTrue(result["synthetic_source_visible"])
        self.assertFalse(result["semantic_available"])

    def test_persistence_uses_one_result_per_run_and_evaluation_key(self):
        sql = evaluation.evaluation_result_upsert_sql()
        self.assertIn("ON CONFLICT (run_id, evaluation_key) DO UPDATE", sql)

    def test_live_retrieval_sql_does_not_use_evaluation_items(self):
        sql, _ = hybrid_retrieval.build_hybrid_evidence_query(["delay"], "dover-calais", False, 6)
        self.assertNotIn("rag_evaluation_items", sql)
```

- [ ] **Step 2: Run the test and confirm it fails because the evaluation module is missing.**

Run: `python3 work/test_rag_evaluation.py`

Expected: `ModuleNotFoundError: No module named 'backend.rag_evaluation'`.

- [ ] **Step 3: Create held-out cases and the pure scoring/persistence module.**

Create six held-out records: two English, two Danish, and two Chinese. Each record must include `evaluation_key`, `question`, `active_view`, `route_focus`, `input_language`, `expectedSourceTiers`, and `expectedDataQueryKey` when it is a structured-data question. Do not copy any question or similar-question variant from `work/rag_question_intents_v3.json`, and do not import this JSON into `evidence_items`.

`build_evaluation_result` must calculate only observable retrieval facts:

```python
{
    "evaluation_key": case["evaluation_key"],
    "selected_route": case.get("route_focus", "all"),
    "retrieval_mode": context["retrieval"]["mode"],
    "retrieved_evidence_ids": [item.get("id") for item in context.get("evidenceItems", [])],
    "data_query_key": (context.get("dataQuery") or {}).get("queryKey"),
    "semantic_available": bool(context["retrieval"].get("semanticAvailable")),
    "expected_source_covered": expected_source_covered,
    "exact_route_rank": exact_route_rank,
    "synthetic_source_visible": any(item.get("isSynthetic") for item in context.get("evidenceItems", [])),
    "answer_available": bool(context.get("evidenceItems") or context.get("dataQuery")),
}
```

Calculate `expected_source_covered` with exact source-tier comparison, not an LLM or text similarity score:

```python
expected_tiers = set(case.get("expectedSourceTiers") or [])
observed_tiers = {item.get("sourceTier") for item in context.get("evidenceItems", [])}
expected_source_covered = bool(expected_tiers & observed_tiers) if expected_tiers else None
```

`persist_evaluation_run` must insert one run row, insert/upsert its result rows in a transaction, then set `completed_at` and `status = 'completed'`. Human score fields remain `NULL`; the runner must not claim automatic semantic answer correctness.

- [ ] **Step 4: Implement the evaluation CLI.**

`work/run_data_rag_evaluation.py` must support:

```text
--set development|heldout|all
--limit N
--run-key NAME
--no-persist
--output outputs/dfds-data-rag-evaluation.json
```

For `development`, load the existing `rag_evaluation_items` rows and mark their expected-source coverage as informational because their expected source names are not a strict held-out retrieval contract. For `heldout`, load only `work/dfds_rag_heldout.json` and calculate all measurable metrics. For every case, call `server.build_rag_context` only; do not call DeepSeek, index question text, or retrieve from `rag_evaluation_items`.

Write a JSON report with `runKey`, `evaluationSet`, `summary`, `results`, and the embedding configuration name/dimension. Persist only when a database connection is available and `--no-persist` is absent.

- [ ] **Step 5: Re-run tests and a non-persistent held-out evaluation.**

Run: `python3 work/test_rag_evaluation.py`

Expected: `OK`.

Run: `python3 work/run_data_rag_evaluation.py --set heldout --no-persist --output /tmp/dfds-data-rag-evaluation.json`

Expected: JSON report exists and lists held-out route, retrieval mode, source visibility, and data-query correctness without a human-quality claim.

### Task 8: Render Provenance and Structured Results in Mia

**Files:**
- Modify: `app/scripts/services/chat-api.mjs`
- Modify: `app/components/chat-widget.jsx`
- Modify: `app/styles.css:1483-1579`
- Modify: `work/test_chat_widget_source.py`

- [ ] **Step 1: Add failing source-level frontend contract tests.**

```python
def test_chat_api_preserves_data_query_and_retrieval_metadata(self):
    self.assertIn("dataQuery: result.dataQuery || null", self.chat_api)
    self.assertIn("retrieval: result.retrieval", self.chat_api)

def test_chat_widget_renders_returned_evidence_and_synthetic_label(self):
    self.assertIn("message.evidence", self.chat_widget)
    self.assertIn("isSynthetic", self.chat_widget)
    self.assertIn("Synthetic", self.chat_widget)

def test_chat_widget_renders_compact_data_query_block(self):
    self.assertIn("message.dataQuery", self.chat_widget)
    self.assertIn("dataQuery.datasetLabel", self.chat_widget)
    self.assertIn("message-data-query", self.chat_styles)
```

- [ ] **Step 2: Run the source tests and confirm they fail.**

Run: `python3 work/test_chat_widget_source.py`

Expected: `FAIL` because the current widget stores only answer, mode, and intent.

- [ ] **Step 3: Pass through and render the new contract.**

In `getLiveChatResponse`, preserve both fields without changing `cleanUserFacingAnswer`:

```javascript
dataQuery: result.dataQuery || null,
retrieval: result.retrieval || { mode: "evidence", semanticAvailable: false }
```

When appending an assistant message, include `evidence: result.evidence`, `dataQuery: result.dataQuery`, and `retrieval: result.retrieval`. Add a local `EvidenceCards` component that displays source, route, title, evidence ID, and a compact `Synthetic` label only when `item.isSynthetic` is true. It must not infer synthetic status from the source name.

Add a `DataQueryBlock` component that always renders `dataQuery.datasetLabel`, `dataQuery.queryKey`, applied filters, and up to six returned rows in a compact, scrollable table. Use column labels created from the row object keys and `String(value)` for all cell values so zero values remain visible. Render the block only when `message.dataQuery` is non-null.

Do not hide the synthetic label behind a hover state. Do not render an empty card if an evidence result has no rows.

- [ ] **Step 4: Add compact responsive styles.**

Add scoped CSS using existing color variables:

```css
.message-data-query {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.message-data-query-table {
  display: block;
  max-width: 100%;
  overflow-x: auto;
}

.provenance-label.synthetic {
  color: #7e211c;
  background: #ffe8e5;
}
```

Keep all chat panels at 8px or lower where the existing design permits it; make the table width stable and scroll rather than allowing labels or cells to overlap on mobile.

- [ ] **Step 5: Re-run frontend source tests and build.**

Run: `python3 work/test_chat_widget_source.py && pnpm build`

Expected: source tests report `OK` and Vite completes successfully.

### Task 9: Add the Interview Runbook and Execute Full Verification

**Files:**
- Create: `docs/dfds-data-rag-demo-runbook.md`
- Modify: `dfds-customer-insights-logs/2026-07-28.md`

- [ ] **Step 1: Write a runbook that states the demo boundary before its commands.**

The first paragraph must say that the demo uses `Synthetic Interview Review Corpus` and `Synthetic Passenger Profile`, plus public snapshots, and is not real DFDS customer or operational data. Include these exact command groups:

```bash
docker compose up -d db
python3 backend/synthetic_interview_reviews.py --replace
python3 work/reindex_rag_embeddings.py --entity all
python3 work/run_data_rag_evaluation.py --set heldout --output outputs/dfds-data-rag-evaluation.json
PORT=8767 python3 server.py
```

Explain that reindexing requires a configured embedding API key, whereas the rest of the demo works keyword-only. Include three interview prompts: a cited evidence question, a Passenger Profile spend/segment question, and a mixed route question. State expected visible labels: `Synthetic`, `Synthetic Interview Review Corpus`, and `Synthetic Passenger Profile`.

- [ ] **Step 2: Add a daily-log entry.**

Append one dated section that records the modules changed, the synthetic-data boundary, focused test commands, full-suite command, build command, and desktop/mobile browser QA outcome. Do not claim API-backed semantic verification when no `RAG_EMBEDDING_API_KEY` has been supplied.

- [ ] **Step 3: Run the complete automated suite.**

Run:

```bash
python3 work/test_data_rag_schema.py \
  && python3 work/test_rag_embeddings.py \
  && python3 work/test_synthetic_interview_reviews.py \
  && python3 work/test_hybrid_retrieval.py \
  && python3 work/test_profile_data_queries.py \
  && python3 work/test_rag_evaluation.py \
  && python3 work/test_server_keywords.py \
  && python3 work/test_mia_response_structure.py \
  && python3 work/test_passenger_profile_import.py \
  && python3 work/test_chat_widget_source.py \
  && pnpm build
```

Expected: every Python module reports `OK` and the build succeeds.

- [ ] **Step 4: Perform browser QA after starting the server.**

Open the local dashboard at `http://127.0.0.1:8767/`. Verify these three calls in desktop and a 390px-wide mobile viewport:

1. Ask for evidence about Dover-Calais delay guidance and request sources. Confirm returned source cards show evidence ID, route, and `Synthetic` only for synthetic records.
2. Ask which segment has the highest order value on Newcastle-IJmuiden. Confirm a compact `Synthetic Passenger Profile` query block appears with a table and no claim that it is real DFDS data.
3. Ask why the high-value North Sea segment might need clearer route communication. Confirm the response can show both evidence and the structured query block.

Confirm no horizontal text overlap, no console errors, no embedding API call when credentials are absent, and `retrieval.semanticAvailable` is `false` in the API response under keyword-only operation.

## Final Review Checklist

- [ ] All schema additions are `IF NOT EXISTS`/idempotent and legacy `vector(16)` columns remain.
- [ ] No code path uses an LLM-generated SQL string or includes a user message directly in SQL text.
- [ ] Every synthetic raw review and evidence chunk exposes source tier, synthetic flag, and version to the API.
- [ ] No test fixture or live retrieval indexes data from `rag_evaluation_items` or `dfds_rag_heldout.json`.
- [ ] Missing/failed embeddings cause keyword-only retrieval rather than hash-vector semantic claims.
- [ ] The UI visibly labels synthetic evidence and the Passenger Profile result set.
- [ ] Evaluation persistence records observable routing/retrieval facts and retains blank human-quality fields.
- [ ] Automated tests, Vite build, desktop QA, and mobile QA have completed before declaring the demo ready.

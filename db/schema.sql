CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ingestion_batches (
  id BIGSERIAL PRIMARY KEY,
  batch_key TEXT NOT NULL UNIQUE,
  source_label TEXT NOT NULL,
  is_synthetic BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_source_rows (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES ingestion_batches(id) ON DELETE CASCADE,
  raw_record_key TEXT NOT NULL,
  workbook_name TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  excel_row INTEGER NOT NULL,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, raw_record_key)
);

CREATE INDEX IF NOT EXISTS idx_raw_source_rows_batch ON raw_source_rows(batch_id);

CREATE TABLE IF NOT EXISTS upload_batches (
  id UUID PRIMARY KEY,
  owner_scope TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('received', 'ready_for_validation', 'failed')),
  file_count INTEGER NOT NULL CHECK (file_count BETWEEN 1 AND 10),
  profiled_row_count INTEGER NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL CHECK (total_bytes > 0),
  manifest_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- owner_scope stores the owning app_users.id for file-level isolation.
CREATE INDEX IF NOT EXISTS idx_upload_batches_owner_scope_created
  ON upload_batches(owner_scope, created_at DESC);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  file_extension TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  parser_state TEXT NOT NULL CHECK (parser_state IN ('profiled', 'received_unparsed')),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, checksum_sha256)
);

CREATE TABLE IF NOT EXISTS uploaded_file_sheets (
  id BIGSERIAL PRIMARY KEY,
  uploaded_file_id UUID NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
  sheet_name TEXT NOT NULL,
  sheet_order INTEGER NOT NULL,
  data_row_count INTEGER NOT NULL DEFAULT 0,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  cleaning_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  schema_fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (uploaded_file_id, sheet_name)
);

CREATE TABLE IF NOT EXISTS upload_batch_events (
  id BIGSERIAL PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  detail TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_batches_owner_created
  ON upload_batches(owner_scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_batch ON uploaded_files(batch_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_file_sheets_file ON uploaded_file_sheets(uploaded_file_id);
CREATE INDEX IF NOT EXISTS idx_upload_batch_events_batch ON upload_batch_events(batch_id, created_at);

CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  company_type TEXT NOT NULL DEFAULT 'operator',
  is_baseline BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routes (
  id BIGSERIAL PRIMARY KEY,
  route_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  region TEXT,
  market TEXT NOT NULL DEFAULT 'passenger',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sources (
  id BIGSERIAL PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  logo_url TEXT,
  source_url TEXT,
  status TEXT NOT NULL,
  last_checked_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence_items (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  route_id BIGINT REFERENCES routes(id) ON DELETE SET NULL,
  evidence_kind TEXT NOT NULL,
  original_content TEXT NOT NULL,
  translated_content TEXT,
  rating NUMERIC(4, 1),
  review_count INTEGER,
  published_at DATE,
  url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  keywords TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  embedding vector(16),
  semantic_embedding vector(1536),
  source_tier TEXT NOT NULL DEFAULT 'public_snapshot' CHECK (source_tier IN ('public_snapshot', 'synthetic_demo')),
  is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  source_version TEXT NOT NULL DEFAULT 'legacy-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, original_content)
);

ALTER TABLE evidence_items
  ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

CREATE TABLE IF NOT EXISTS raw_reviews (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  external_review_id TEXT NOT NULL,
  source_review_url TEXT,
  title TEXT,
  review_text TEXT NOT NULL,
  rating NUMERIC(4, 1),
  language TEXT,
  consumer_display_name TEXT,
  consumer_location TEXT,
  is_verified BOOLEAN,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  experienced_at TIMESTAMPTZ,
  company_reply TEXT,
  company_reply_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  source_version TEXT NOT NULL DEFAULT 'legacy-v1',
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, external_review_id)
);

CREATE INDEX IF NOT EXISTS idx_raw_reviews_source ON raw_reviews(source_id);
CREATE INDEX IF NOT EXISTS idx_raw_reviews_company ON raw_reviews(company_id);
CREATE INDEX IF NOT EXISTS idx_raw_reviews_published_at ON raw_reviews(published_at);
CREATE INDEX IF NOT EXISTS idx_raw_reviews_rating ON raw_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_raw_reviews_metadata_gin ON raw_reviews USING gin (metadata);

ALTER TABLE evidence_items
  ADD COLUMN IF NOT EXISTS semantic_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS source_tier TEXT NOT NULL DEFAULT 'public_snapshot',
  ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_version TEXT NOT NULL DEFAULT 'legacy-v1',
  ADD COLUMN IF NOT EXISTS raw_review_id BIGINT REFERENCES raw_reviews(id) ON DELETE SET NULL;

ALTER TABLE raw_reviews
  ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_version TEXT NOT NULL DEFAULT 'legacy-v1';

UPDATE evidence_items
SET source_tier = 'synthetic_demo', is_synthetic = TRUE
WHERE metadata->>'synthetic_source' = 'true'
   OR metadata->>'synthetic' = 'true'
   OR source_id IN (SELECT id FROM sources WHERE source_key LIKE 'synthetic-%');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evidence_items_source_tier_check'
      AND conrelid = 'evidence_items'::regclass
  ) THEN
    ALTER TABLE evidence_items
      ADD CONSTRAINT evidence_items_source_tier_check
      CHECK (source_tier IN ('public_snapshot', 'synthetic_demo'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS keywords (
  id BIGSERIAL PRIMARY KEY,
  keyword_key TEXT NOT NULL UNIQUE,
  display_label TEXT NOT NULL,
  keyword_type TEXT NOT NULL DEFAULT 'topic',
  keyword_category TEXT NOT NULL DEFAULT 'general',
  language TEXT NOT NULL DEFAULT 'en',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence_keywords (
  evidence_id BIGINT NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  keyword_id BIGINT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  weight NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
  source TEXT NOT NULL DEFAULT 'derived',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (evidence_id, keyword_id)
);

CREATE TABLE IF NOT EXISTS insight_items (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  route_id BIGINT REFERENCES routes(id) ON DELETE SET NULL,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  supporting_evidence_ids BIGINT[] NOT NULL DEFAULT '{}'::BIGINT[],
  confidence TEXT,
  business_impact TEXT,
  time_period TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(16),
  semantic_embedding vector(1536),
  is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE insight_items
  ADD COLUMN IF NOT EXISTS semantic_embedding vector(1536),
  ADD COLUMN IF NOT EXISTS is_synthetic BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE insight_items
SET is_synthetic = TRUE
WHERE metadata->>'synthetic' = 'true'
   OR metadata->>'synthetic_source' = 'true';

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY,
  user_id UUID,
  user_language TEXT NOT NULL DEFAULT 'English',
  active_view TEXT NOT NULL DEFAULT 'Overview',
  route_focus TEXT NOT NULL DEFAULT 'all',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('project_user', 'administrator')) DEFAULT 'project_user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username);

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES app_users(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS user_access_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rag_usage_events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  retrieval_trace JSONB NOT NULL DEFAULT '{}'::jsonb,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_summary_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  summary_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  message_text TEXT NOT NULL,
  translated_text TEXT,
  evidence_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS page_context JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS project_memories (
  id BIGSERIAL PRIMARY KEY,
  memory_key TEXT NOT NULL UNIQUE,
  memory_layer TEXT NOT NULL CHECK (memory_layer IN ('short_term', 'medium_term', 'long_term')),
  memory_type TEXT NOT NULL,
  title TEXT NOT NULL,
  memory_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'active',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(16),
  semantic_embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_memories
  ADD COLUMN IF NOT EXISTS semantic_embedding vector(1536);

CREATE TABLE IF NOT EXISTS rag_evaluation_items (
  id BIGSERIAL PRIMARY KEY,
  evaluation_key TEXT NOT NULL UNIQUE,
  active_view TEXT NOT NULL,
  route_focus TEXT NOT NULL DEFAULT 'all',
  input_language TEXT NOT NULL DEFAULT 'English',
  question TEXT NOT NULL,
  expected_answer TEXT NOT NULL,
  expected_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  retrieved_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  retrieval_notes TEXT,
  human_score NUMERIC(3, 1) CHECK (human_score IS NULL OR (human_score >= 0 AND human_score <= 5)),
  human_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  embedding vector(16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

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

CREATE TABLE IF NOT EXISTS review_runs (
  id BIGSERIAL PRIMARY KEY,
  run_key TEXT NOT NULL UNIQUE,
  run_type TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_items (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT REFERENCES review_runs(id) ON DELETE SET NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT,
  subject_label TEXT NOT NULL,
  layer TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  recommendation TEXT,
  publish_state TEXT NOT NULL DEFAULT 'internal_only',
  route_key TEXT NOT NULL DEFAULT 'all',
  source_key TEXT,
  language TEXT,
  original_output TEXT,
  supervisor_verdict TEXT,
  suggested_fix TEXT,
  downstream_impact TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_item_evidence (
  review_item_id BIGINT NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
  evidence_id BIGINT NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'supports',
  position INTEGER NOT NULL DEFAULT 0,
  weight NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (review_item_id, evidence_id, relation_type)
);

CREATE TABLE IF NOT EXISTS review_item_keywords (
  review_item_id BIGINT NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
  keyword_id BIGINT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'context',
  position INTEGER NOT NULL DEFAULT 0,
  weight NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (review_item_id, keyword_id, relation_type)
);

CREATE TABLE IF NOT EXISTS review_item_raw_reviews (
  review_item_id BIGINT NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
  raw_review_id BIGINT NOT NULL REFERENCES raw_reviews(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'provenance',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (review_item_id, raw_review_id, relation_type)
);

CREATE TABLE IF NOT EXISTS review_item_artifacts (
  id BIGSERIAL PRIMARY KEY,
  review_item_id BIGINT NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  artifact_path TEXT NOT NULL,
  artifact_label TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_item_actions (
  id BIGSERIAL PRIMARY KEY,
  review_item_id BIGINT NOT NULL REFERENCES review_items(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL DEFAULT 'human',
  actor_name TEXT NOT NULL DEFAULT 'Internal reviewer',
  action_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routes_key ON routes(route_key);
CREATE INDEX IF NOT EXISTS idx_sources_key ON sources(source_key);
CREATE INDEX IF NOT EXISTS idx_evidence_source ON evidence_items(source_id);
CREATE INDEX IF NOT EXISTS idx_evidence_company ON evidence_items(company_id);
CREATE INDEX IF NOT EXISTS idx_evidence_route ON evidence_items(route_id);
CREATE INDEX IF NOT EXISTS idx_evidence_kind ON evidence_items(evidence_kind);
CREATE INDEX IF NOT EXISTS idx_evidence_source_route_kind ON evidence_items(source_id, route_id, evidence_kind);
CREATE INDEX IF NOT EXISTS idx_evidence_published_at ON evidence_items(published_at);
CREATE INDEX IF NOT EXISTS idx_evidence_rating_volume ON evidence_items(rating, review_count);
CREATE INDEX IF NOT EXISTS idx_evidence_metadata_gin ON evidence_items USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_evidence_keywords_gin ON evidence_items USING gin (keywords);
CREATE INDEX IF NOT EXISTS idx_keywords_type_category ON keywords(keyword_type, keyword_category);
CREATE INDEX IF NOT EXISTS idx_keywords_label ON keywords(display_label);
CREATE INDEX IF NOT EXISTS idx_evidence_keywords_keyword ON evidence_keywords(keyword_id);
CREATE INDEX IF NOT EXISTS idx_evidence_keywords_evidence ON evidence_keywords(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_keywords_metadata_gin ON evidence_keywords USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_insight_company ON insight_items(company_id);
CREATE INDEX IF NOT EXISTS idx_insight_route ON insight_items(route_id);
CREATE INDEX IF NOT EXISTS idx_insight_type ON insight_items(insight_type);
CREATE INDEX IF NOT EXISTS idx_insight_metadata_gin ON insight_items USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_usage_events_user_created ON rag_usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_summary_history_user_created ON user_summary_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_memories_layer_status ON project_memories(memory_layer, status);
CREATE INDEX IF NOT EXISTS idx_project_memories_metadata_gin ON project_memories USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_rag_evaluation_status ON rag_evaluation_items(status);
CREATE INDEX IF NOT EXISTS idx_rag_evaluation_results_run ON rag_evaluation_results(run_id, evaluation_key);
CREATE INDEX IF NOT EXISTS idx_evidence_provenance ON evidence_items(source_tier, is_synthetic, source_version);
CREATE INDEX IF NOT EXISTS idx_evidence_raw_review ON evidence_items(raw_review_id);
CREATE INDEX IF NOT EXISTS idx_review_runs_key ON review_runs(run_key);
CREATE INDEX IF NOT EXISTS idx_review_items_run ON review_items(run_id);
CREATE INDEX IF NOT EXISTS idx_review_items_layer_status ON review_items(layer, status);
CREATE INDEX IF NOT EXISTS idx_review_items_route ON review_items(route_key);
CREATE INDEX IF NOT EXISTS idx_review_items_source ON review_items(source_key);
CREATE INDEX IF NOT EXISTS idx_review_items_metadata_gin ON review_items USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_review_item_evidence_evidence ON review_item_evidence(evidence_id);
CREATE INDEX IF NOT EXISTS idx_review_item_keywords_keyword ON review_item_keywords(keyword_id);
CREATE INDEX IF NOT EXISTS idx_review_item_raw_reviews_raw_review ON review_item_raw_reviews(raw_review_id);
CREATE INDEX IF NOT EXISTS evidence_embedding_idx
  ON evidence_items USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

DO $$
BEGIN
  BEGIN
    CREATE INDEX IF NOT EXISTS idx_evidence_semantic_embedding
      ON evidence_items USING hnsw (semantic_embedding vector_cosine_ops);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'HNSW index for semantic evidence skipped: %', SQLERRM;
  END;

  BEGIN
    CREATE INDEX IF NOT EXISTS idx_insight_semantic_embedding
      ON insight_items USING hnsw (semantic_embedding vector_cosine_ops);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'HNSW index for semantic insights skipped: %', SQLERRM;
  END;

  BEGIN
    CREATE INDEX IF NOT EXISTS idx_project_memory_semantic_embedding
      ON project_memories USING hnsw (semantic_embedding vector_cosine_ops);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'HNSW index for semantic project memories skipped: %', SQLERRM;
  END;

  BEGIN
    CREATE INDEX IF NOT EXISTS evidence_embedding_hnsw_idx
      ON evidence_items USING hnsw (embedding vector_cosine_ops);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'HNSW index for evidence_items skipped: %', SQLERRM;
  END;

  BEGIN
    CREATE INDEX IF NOT EXISTS insight_embedding_hnsw_idx
      ON insight_items USING hnsw (embedding vector_cosine_ops);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'HNSW index for insight_items skipped: %', SQLERRM;
  END;

  BEGIN
    CREATE INDEX IF NOT EXISTS project_memory_embedding_hnsw_idx
      ON project_memories USING hnsw (embedding vector_cosine_ops);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'HNSW index for project_memories skipped: %', SQLERRM;
  END;
END $$;

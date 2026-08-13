# Mia's Cruises Internal Review Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone internal review console that lets the Mia's Cruises team inspect validation/reflection results, evidence chains, and publish readiness before new agent outputs are surfaced in the dashboard.

**Architecture:** Add a normalized review data layer to PostgreSQL, expose read/update review endpoints from the existing Python backend, and add a new static JS dashboard page using the existing module pattern. The first version seeds representative review records from the July 16-21 project logs so the console is immediately useful even before live validator agents write records.

**Tech Stack:** Python `server.py`, PostgreSQL + pgvector schema, static HTML/CSS/native ES modules, existing `app/data/*.mjs` update-log pattern, Python `unittest`, Node syntax checks.

---

## Important Constraints

- The project directory is not currently a git repository, so replace commit steps with a final changed-file summary.
- Keep `Update Log` separate from the new `Review Console`.
- Do not block existing static dashboard content. The review gate applies only to new agent-generated outputs, evidence imports, and recommendation writebacks after this layer exists.
- Do not call Firecrawl or any paid/external crawler while implementing this console.
- Keep DeepSeek keys out of frontend files, `package.json`, logs, and committed project files.
- After frontend module changes, update `app/index.html` cache-busting and `app/app.js` module import versions.
- Update `app/data/update-log.mjs` before updating `mias-cruises-customer-insights-logs/2026-07-21.md`.

## File Map

- Modify `db/schema.sql`: add review tables, indexes, and constraints.
- Modify `server.py`: add seed review records, review serialization helpers, list/detail/update endpoints, and health counts.
- Create `work/test_review_console.py`: unit tests for seeded review record shape, filtering helpers, and update validation.
- Create `app/data/review-console.mjs`: frontend fallback seed records for static rendering when backend is unavailable.
- Create `app/scripts/features/review-console.mjs`: render queue, filters, detail panel, evidence chain, and status actions.
- Modify `app/app.js`: import and initialize review console module with cache-busting.
- Modify `app/index.html`: add nav item and `reviewconsole` view.
- Modify `app/styles.css`: add dense internal console layout and responsive behavior.
- Modify `app/data/update-log.mjs`: add product update entry.
- Modify `mias-cruises-customer-insights-logs/2026-07-21.md`: record the implementation and verification.

## Task 1: Database Review Tables

**Files:**
- Modify: `db/schema.sql`
- Test: `work/test_review_console.py`

- [ ] **Step 1: Add a failing schema test**

Create `work/test_review_console.py` with:

```python
#!/usr/bin/env python3
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "db" / "schema.sql").read_text(encoding="utf-8")


class ReviewConsoleSchemaTests(unittest.TestCase):
    def test_review_tables_exist(self):
        for table in [
            "review_runs",
            "review_items",
            "review_item_evidence",
            "review_item_keywords",
            "review_item_raw_reviews",
            "review_item_artifacts",
            "review_item_actions",
        ]:
            self.assertRegex(SCHEMA, rf"CREATE TABLE IF NOT EXISTS {table}\\b")

    def test_review_items_can_represent_log_derived_harness_layers(self):
        required_columns = [
            "layer TEXT NOT NULL",
            "status TEXT NOT NULL",
            "severity TEXT NOT NULL",
            "publish_state TEXT NOT NULL",
            "route_key TEXT NOT NULL",
            "language TEXT",
            "metadata JSONB NOT NULL DEFAULT '{}'::jsonb",
        ]
        for column in required_columns:
            self.assertIn(column, SCHEMA)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the schema test and verify it fails**

Run:

```bash
python3 -m unittest work/test_review_console.py -v
```

Expected: FAIL because `review_runs` and related tables do not exist yet.

- [ ] **Step 3: Add review tables to `db/schema.sql`**

Insert this block after `rag_evaluation_items`:

```sql
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
```

Add these indexes after the existing review/rag indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_review_runs_key ON review_runs(run_key);
CREATE INDEX IF NOT EXISTS idx_review_items_run ON review_items(run_id);
CREATE INDEX IF NOT EXISTS idx_review_items_layer_status ON review_items(layer, status);
CREATE INDEX IF NOT EXISTS idx_review_items_route ON review_items(route_key);
CREATE INDEX IF NOT EXISTS idx_review_items_source ON review_items(source_key);
CREATE INDEX IF NOT EXISTS idx_review_items_metadata_gin ON review_items USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_review_item_evidence_evidence ON review_item_evidence(evidence_id);
CREATE INDEX IF NOT EXISTS idx_review_item_keywords_keyword ON review_item_keywords(keyword_id);
CREATE INDEX IF NOT EXISTS idx_review_item_raw_reviews_raw_review ON review_item_raw_reviews(raw_review_id);
```

- [ ] **Step 4: Run the schema test again**

Run:

```bash
python3 -m unittest work/test_review_console.py -v
```

Expected: PASS.

## Task 2: Backend Seed Data and API

**Files:**
- Modify: `server.py`
- Modify: `work/test_review_console.py`

- [ ] **Step 1: Add failing backend tests**

Append to `work/test_review_console.py`:

```python
import server


class ReviewConsoleBackendTests(unittest.TestCase):
    def test_seed_items_cover_log_layers(self):
        layers = {item["layer"] for item in server.REVIEW_CONSOLE_SEED_ITEMS}
        self.assertTrue({"scope", "collection", "retrieval", "language", "release"}.issubset(layers))

    def test_review_status_validation(self):
        self.assertTrue(server.is_valid_review_status("needs_changes"))
        self.assertFalse(server.is_valid_review_status("ship-it"))

    def test_filter_review_items_by_query(self):
        items = [
            {"title": "Mia weather guard", "reason": "Weather must not trigger evidence", "layer": "language", "status": "pending", "severity": "high", "route_key": "all"},
            {"title": "Dover-Calais route mismatch", "reason": "Route focus issue", "layer": "retrieval", "status": "approved", "severity": "medium", "route_key": "dover-calais"},
        ]
        result = server.filter_review_seed_items(items, {"q": ["weather"], "layer": ["language"]})
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["title"], "Mia weather guard")
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
python3 -m unittest work/test_review_console.py -v
```

Expected: FAIL because `REVIEW_CONSOLE_SEED_ITEMS`, `is_valid_review_status`, and `filter_review_seed_items` do not exist.

- [ ] **Step 3: Add seed constants and helpers to `server.py`**

Add near `PROJECT_MEMORY_SEEDS`:

```python
VALID_REVIEW_STATUSES = {"pending", "approved", "needs_changes", "rejected"}

REVIEW_CONSOLE_SEED_ITEMS = [
    {
        "review_key": "seed-20260716-route-filter-scope",
        "title": "Route filter only appears where route focus changes content",
        "layer": "scope",
        "status": "approved",
        "severity": "medium",
        "source": "dashboard generation",
        "route_key": "all",
        "reason": "July 16 logs required route focus to be hidden on App Reviews, Competitors, Survey CSV, Update Log, and Data Basis.",
        "recommendation": "Keep route controls limited to Overview, Customer Voice, and Recommendations.",
        "publish_state": "verified",
        "evidence_chain": ["input context", "UI route behavior", "supervisor judgment", "visibility decision"],
        "artifacts": ["mias-cruises-customer-insights-logs/2026-07-16.md"],
        "metadata": {"seeded_from_log": True, "log_date": "2026-07-16"},
    },
    {
        "review_key": "seed-20260717-source-limitations",
        "title": "Public source limitations are labeled honestly",
        "layer": "collection",
        "status": "needs_changes",
        "severity": "high",
        "source": "evidence import",
        "route_key": "all",
        "reason": "July 17 logs say Google Reviews are location-level signals, Reddit is discussion signal, and Firecrawl search-result snapshots are directional evidence.",
        "recommendation": "Show collection method and limitation labels before using source evidence in recommendations.",
        "publish_state": "internal_only",
        "evidence_chain": ["collection attempt", "source limitation", "normalized source row", "supervisor judgment"],
        "artifacts": ["mias-cruises-customer-insights-logs/2026-07-17.md"],
        "metadata": {"seeded_from_log": True, "log_date": "2026-07-17"},
    },
    {
        "review_key": "seed-20260720-rag-context",
        "title": "RAG answers use database, page context, memory, and fallback evidence",
        "layer": "retrieval",
        "status": "pending",
        "severity": "high",
        "source": "RAG retrieval",
        "route_key": "all",
        "reason": "July 20 logs introduced PostgreSQL + pgvector, project memories, recent chat history, and frontend fallback evidence.",
        "recommendation": "Flag answers that cite irrelevant evidence or miss obvious visible dashboard evidence.",
        "publish_state": "internal_only",
        "evidence_chain": ["page context", "evidence_items", "project_memories", "chat history", "supervisor judgment"],
        "artifacts": ["outputs/dfds-rag-validation-set.xlsx", "mias-cruises-customer-insights-logs/2026-07-20.md"],
        "metadata": {"seeded_from_log": True, "log_date": "2026-07-20"},
    },
    {
        "review_key": "seed-20260721-mia-weather-language",
        "title": "Mia weather and multilingual guardrails do not leak evidence cards",
        "layer": "language",
        "status": "pending",
        "severity": "high",
        "source": "chat answer",
        "route_key": "all",
        "reason": "July 21 logs require weather, small talk, and off-topic prompts to skip retrieval; non-English evidence summaries must avoid long English evidence bodies.",
        "recommendation": "Test weather, greeting, Chinese Dover-Calais, and Danish prompts before publishing chat changes.",
        "publish_state": "internal_only",
        "evidence_chain": ["input message", "intent guard", "route detection", "language formatting", "supervisor judgment"],
        "artifacts": ["mias-cruises-customer-insights-logs/2026-07-21.md"],
        "metadata": {"seeded_from_log": True, "log_date": "2026-07-21"},
    },
    {
        "review_key": "seed-20260718-21-cache-release",
        "title": "Frontend cache-busting and Update Log sequencing are checked",
        "layer": "release",
        "status": "needs_changes",
        "severity": "medium",
        "source": "release hygiene",
        "route_key": "all",
        "reason": "July 18 through July 21 logs repeatedly show browser cache caused old dashboard or Mia logic to stay visible.",
        "recommendation": "Require `app/index.html`, `app/app.js`, `app/data/update-log.mjs`, and the daily log to move together for frontend releases.",
        "publish_state": "internal_only",
        "evidence_chain": ["module change", "cache version", "Update Log entry", "daily log", "supervisor judgment"],
        "artifacts": ["mias-cruises-customer-insights-logs/2026-07-18.md", "mias-cruises-customer-insights-logs/2026-07-21.md"],
        "metadata": {"seeded_from_log": True, "log_date": "2026-07-21"},
    },
]


def is_valid_review_status(value):
    return str(value or "") in VALID_REVIEW_STATUSES


def filter_review_seed_items(items, params):
    def first(name):
        value = params.get(name, [""])[0] if isinstance(params.get(name), list) else params.get(name, "")
        return str(value or "").strip().lower()

    query = first("q")
    layer = first("layer")
    status = first("status")
    severity = first("severity")
    route = first("route")

    filtered = []
    for item in items:
        haystack = f"{item.get('title', '')} {item.get('reason', '')} {item.get('recommendation', '')}".lower()
        if query and query not in haystack:
            continue
        if layer and item.get("layer") != layer:
            continue
        if status and item.get("status") != status:
            continue
        if severity and item.get("severity") != severity:
            continue
        if route and item.get("route_key") != route:
            continue
        filtered.append(item)
    return filtered
```

- [ ] **Step 4: Add backend endpoints**

Import query parsing at the top:

```python
from urllib.parse import parse_qs, urlparse
```

Add helper functions before `class Handler`:

```python
def list_review_items(params=None):
    params = params or {}
    conn = connect_db()
    if conn is None:
        return {"connected": False, "items": filter_review_seed_items(REVIEW_CONSOLE_SEED_ITEMS, params)}

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, subject_type, subject_id, subject_label, layer, status, severity,
                       title, reason, recommendation, publish_state, route_key, source_key,
                       language, original_output, supervisor_verdict, suggested_fix,
                       downstream_impact, metadata, created_at, updated_at
                FROM review_items
                ORDER BY created_at DESC, id DESC
                LIMIT 200
                """
            )
            rows = [dict(row) for row in cur.fetchall()]
            return {"connected": True, "items": filter_review_seed_items(rows, params)}
    finally:
        conn.close()


def update_review_item_status(item_id, payload):
    status = str(payload.get("status", "")).strip()
    notes = str(payload.get("notes", "")).strip()
    actor_name = str(payload.get("actorName") or "Internal reviewer")[:120]
    if not is_valid_review_status(status):
        return 400, {"error": "Invalid review status"}

    conn = connect_db()
    if conn is None:
        return 503, {"error": "Database is not connected; seed review items are read-only"}

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE review_items
                SET status = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING id, status
                """,
                (status, item_id),
            )
            row = cur.fetchone()
            if row is None:
                conn.rollback()
                return 404, {"error": "Review item not found"}
            cur.execute(
                """
                INSERT INTO review_item_actions (review_item_id, actor_type, actor_name, action_type, notes)
                VALUES (%s, 'human', %s, %s, %s)
                """,
                (item_id, actor_name, status, notes),
            )
        conn.commit()
        return 200, {"item": dict(row)}
    finally:
        conn.close()
```

Modify `Handler.do_GET`:

```python
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json(200, {"status": "ok", "database": database_summary()})
            return
        if parsed.path == "/api/review-items":
            self.send_json(200, list_review_items(parse_qs(parsed.query)))
            return
        super().do_GET()
```

Modify `Handler.do_POST` routing before the chat-only guard:

```python
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/review-items/") and parsed.path.endswith("/status"):
            length = int(self.headers.get("Content-Length", "0"))
            try:
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
            except json.JSONDecodeError:
                self.send_json(400, {"error": "Invalid JSON"})
                return
            item_id = parsed.path.split("/")[-2]
            status, response = update_review_item_status(item_id, payload)
            self.send_json(status, response)
            return

        if parsed.path != "/api/chat":
            self.send_json(404, {"error": "Not found"})
            return
```

- [ ] **Step 5: Run backend tests**

Run:

```bash
python3 -m unittest work/test_review_console.py -v
python3 -m py_compile server.py
```

Expected: PASS and no compile output.

## Task 3: Frontend Review Console Page

**Files:**
- Create: `app/data/review-console.mjs`
- Create: `app/scripts/features/review-console.mjs`
- Modify: `app/app.js`
- Modify: `app/index.html`

- [ ] **Step 1: Create fallback review data**

Create `app/data/review-console.mjs`:

```javascript
export const reviewConsoleSeedItems = [
  {
    id: "seed-20260716-route-filter-scope",
    title: "Route filter only appears where route focus changes content",
    layer: "scope",
    status: "approved",
    severity: "medium",
    source: "dashboard generation",
    route_key: "all",
    reason: "July 16 logs required route focus to be hidden on App Reviews, Competitors, Survey CSV, Update Log, and Data Basis.",
    recommendation: "Keep route controls limited to Overview, Customer Voice, and Recommendations.",
    publish_state: "verified",
    evidence_chain: ["input context", "UI route behavior", "supervisor judgment", "visibility decision"],
    artifacts: ["mias-cruises-customer-insights-logs/2026-07-16.md"]
  },
  {
    id: "seed-20260717-source-limitations",
    title: "Public source limitations are labeled honestly",
    layer: "collection",
    status: "needs_changes",
    severity: "high",
    source: "evidence import",
    route_key: "all",
    reason: "Google Reviews are location-level, Reddit is discussion signal, and Firecrawl search-result snapshots are directional evidence.",
    recommendation: "Show collection method and limitation labels before using source evidence in recommendations.",
    publish_state: "internal_only",
    evidence_chain: ["collection attempt", "source limitation", "normalized source row", "supervisor judgment"],
    artifacts: ["mias-cruises-customer-insights-logs/2026-07-17.md"]
  },
  {
    id: "seed-20260720-rag-context",
    title: "RAG answers use database, page context, memory, and fallback evidence",
    layer: "retrieval",
    status: "pending",
    severity: "high",
    source: "RAG retrieval",
    route_key: "all",
    reason: "PostgreSQL + pgvector, project memories, recent chat history, and frontend fallback evidence must work together.",
    recommendation: "Flag answers that cite irrelevant evidence or miss obvious visible dashboard evidence.",
    publish_state: "internal_only",
    evidence_chain: ["page context", "evidence_items", "project_memories", "chat history", "supervisor judgment"],
    artifacts: ["outputs/dfds-rag-validation-set.xlsx", "mias-cruises-customer-insights-logs/2026-07-20.md"]
  },
  {
    id: "seed-20260721-mia-weather-language",
    title: "Mia weather and multilingual guardrails do not leak evidence cards",
    layer: "language",
    status: "pending",
    severity: "high",
    source: "chat answer",
    route_key: "all",
    reason: "Weather, small talk, and off-topic prompts must skip retrieval; non-English evidence summaries must avoid long English evidence bodies.",
    recommendation: "Test weather, greeting, Chinese Dover-Calais, and Danish prompts before publishing chat changes.",
    publish_state: "internal_only",
    evidence_chain: ["input message", "intent guard", "route detection", "language formatting", "supervisor judgment"],
    artifacts: ["mias-cruises-customer-insights-logs/2026-07-21.md"]
  },
  {
    id: "seed-20260718-21-cache-release",
    title: "Frontend cache-busting and Update Log sequencing are checked",
    layer: "release",
    status: "needs_changes",
    severity: "medium",
    source: "release hygiene",
    route_key: "all",
    reason: "Browser cache repeatedly caused old dashboard or Mia logic to stay visible.",
    recommendation: "Require cache versions, Update Log, and daily logs to move together for frontend releases.",
    publish_state: "internal_only",
    evidence_chain: ["module change", "cache version", "Update Log entry", "daily log", "supervisor judgment"],
    artifacts: ["mias-cruises-customer-insights-logs/2026-07-18.md", "mias-cruises-customer-insights-logs/2026-07-21.md"]
  }
];
```

- [ ] **Step 2: Create the renderer module**

Create `app/scripts/features/review-console.mjs`:

```javascript
import { reviewConsoleSeedItems } from "../../data/review-console.mjs";
import { $ } from "../core/dom.mjs";

const labels = {
  pending: "Pending",
  approved: "Approved",
  needs_changes: "Needs changes",
  rejected: "Rejected",
  verified: "Verified",
  internal_only: "Internal only"
};

let reviewItems = reviewConsoleSeedItems;
let selectedId = reviewItems[0]?.id;

function label(value) {
  return labels[value] || String(value || "Unknown").replaceAll("_", " ");
}

function optionValues(key) {
  return [...new Set(reviewItems.map((item) => item[key]).filter(Boolean))].sort();
}

function currentFilters() {
  return {
    q: $("#reviewSearch")?.value.trim().toLowerCase() || "",
    layer: $("#reviewLayerFilter")?.value || "",
    status: $("#reviewStatusFilter")?.value || "",
    severity: $("#reviewSeverityFilter")?.value || ""
  };
}

function filteredItems() {
  const filters = currentFilters();
  return reviewItems.filter((item) => {
    const haystack = `${item.title} ${item.reason} ${item.recommendation}`.toLowerCase();
    return (!filters.q || haystack.includes(filters.q)) &&
      (!filters.layer || item.layer === filters.layer) &&
      (!filters.status || item.status === filters.status) &&
      (!filters.severity || item.severity === filters.severity);
  });
}

function renderFilterOptions() {
  $("#reviewLayerFilter").innerHTML = `<option value="">All layers</option>${optionValues("layer").map((value) => `<option value="${value}">${label(value)}</option>`).join("")}`;
  $("#reviewStatusFilter").innerHTML = `<option value="">All statuses</option>${optionValues("status").map((value) => `<option value="${value}">${label(value)}</option>`).join("")}`;
  $("#reviewSeverityFilter").innerHTML = `<option value="">All severities</option>${optionValues("severity").map((value) => `<option value="${value}">${label(value)}</option>`).join("")}`;
}

function renderQueue() {
  const items = filteredItems();
  $("#reviewQueue").innerHTML = items.map((item) => `
    <button class="review-row ${item.id === selectedId ? "active" : ""}" data-review-id="${item.id}">
      <span class="review-row-title">${item.title}</span>
      <span class="review-row-meta">${label(item.layer)} · ${label(item.route_key)}</span>
      <span class="review-row-badges">
        <span class="review-badge status-${item.status}">${label(item.status)}</span>
        <span class="review-badge severity-${item.severity}">${label(item.severity)}</span>
      </span>
    </button>
  `).join("") || `<div class="review-empty">No review items match the current filters.</div>`;
}

function renderDetail() {
  const item = reviewItems.find((candidate) => candidate.id === selectedId) || filteredItems()[0] || reviewItems[0];
  if (!item) {
    $("#reviewDetail").innerHTML = `<div class="review-empty">The console is waiting for the first validated run.</div>`;
    return;
  }
  selectedId = item.id;
  $("#reviewDetail").innerHTML = `
    <div class="review-detail-header">
      <div>
        <p class="eyebrow">${label(item.layer)} review</p>
        <h3>${item.title}</h3>
      </div>
      <span class="review-badge status-${item.status}">${label(item.status)}</span>
    </div>
    <dl class="review-fields">
      <div><dt>Reason</dt><dd>${item.reason}</dd></div>
      <div><dt>Recommendation</dt><dd>${item.recommendation}</dd></div>
      <div><dt>Source</dt><dd>${item.source || "Internal review"}</dd></div>
      <div><dt>Publish state</dt><dd>${label(item.publish_state)}</dd></div>
    </dl>
    <div class="review-actions" aria-label="Review actions">
      <button class="secondary-button" data-review-status="approved">Approve</button>
      <button class="secondary-button" data-review-status="needs_changes">Needs changes</button>
      <button class="secondary-button" data-review-status="rejected">Reject</button>
    </div>
  `;
  $("#reviewEvidenceChain").innerHTML = `
    <h3>Evidence chain</h3>
    <ol>${(item.evidence_chain || []).map((step) => `<li>${step}</li>`).join("")}</ol>
    <h3>Artifacts</h3>
    <ul>${(item.artifacts || []).map((path) => `<li><code>${path}</code></li>`).join("")}</ul>
  `;
}

async function loadReviewItems() {
  try {
    const response = await fetch("/api/review-items");
    if (!response.ok) {
      throw new Error(`Review API returned ${response.status}`);
    }
    const payload = await response.json();
    reviewItems = payload.items?.length ? payload.items.map((item) => ({ id: item.id || item.review_key, ...item })) : reviewConsoleSeedItems;
    selectedId = reviewItems[0]?.id;
  } catch {
    reviewItems = reviewConsoleSeedItems;
    selectedId = reviewItems[0]?.id;
  }
}

function bindReviewConsoleEvents() {
  ["reviewSearch", "reviewLayerFilter", "reviewStatusFilter", "reviewSeverityFilter"].forEach((id) => {
    $(`#${id}`)?.addEventListener("input", () => {
      renderQueue();
      renderDetail();
    });
  });

  $("#reviewQueue")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-review-id]");
    if (!row) return;
    selectedId = row.dataset.reviewId;
    renderQueue();
    renderDetail();
  });

  $("#reviewDetail")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-review-status]");
    if (!button) return;
    const item = reviewItems.find((candidate) => String(candidate.id) === String(selectedId));
    if (!item) return;
    item.status = button.dataset.reviewStatus;
    renderQueue();
    renderDetail();
  });
}

export async function renderReviewConsole() {
  if (!$("#reviewConsole")) return;
  await loadReviewItems();
  renderFilterOptions();
  renderQueue();
  renderDetail();
  bindReviewConsoleEvents();
}
```

- [ ] **Step 3: Add HTML view and navigation**

In `app/index.html`, add this nav button after `Data Basis`:

```html
<button class="nav-item" data-view="reviewconsole">Review Console</button>
```

Add this view after the `sources` view:

```html
<section class="view" id="reviewconsole">
  <section class="page-summary">
    <div>
      <p class="eyebrow">Internal review</p>
      <h3>Inspect validation and reflection results before publish</h3>
      <p>This page is for the internal team to check evidence chains, harness layers, and publish readiness for new agent outputs.</p>
    </div>
  </section>

  <section class="review-console" id="reviewConsole">
    <div class="review-toolbar">
      <input id="reviewSearch" type="search" placeholder="Search review items" aria-label="Search review items" />
      <select id="reviewLayerFilter" aria-label="Filter by layer"></select>
      <select id="reviewStatusFilter" aria-label="Filter by status"></select>
      <select id="reviewSeverityFilter" aria-label="Filter by severity"></select>
    </div>
    <div class="review-layout">
      <div class="review-queue" id="reviewQueue"></div>
      <article class="review-detail" id="reviewDetail"></article>
      <aside class="review-evidence" id="reviewEvidenceChain"></aside>
    </div>
  </section>
</section>
```

Update the final app script cache version:

```html
<script type="module" src="./app.js?v=20260721-0200"></script>
```

- [ ] **Step 4: Wire app bootstrap**

In `app/app.js`, add:

```javascript
import { renderReviewConsole } from "./scripts/features/review-console.mjs?v=20260721-0200";
```

Call inside `init()` after `renderUpdateLog()`:

```javascript
  renderReviewConsole();
```

Update the data import version:

```javascript
import "./data.js?v=20260721-0200";
```

- [ ] **Step 5: Run syntax checks**

Run:

```bash
node --check app/data/review-console.mjs
node --check app/scripts/features/review-console.mjs
node --check app/app.js
```

Expected: all commands exit 0.

## Task 4: Review Console Styling

**Files:**
- Modify: `app/styles.css`

- [ ] **Step 1: Add dense internal console styles**

Append:

```css
.review-console {
  display: grid;
  gap: 16px;
}

.review-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) repeat(3, minmax(140px, 180px));
  gap: 10px;
  align-items: center;
}

.review-toolbar input,
.review-toolbar select {
  min-height: 40px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  padding: 0 12px;
  font: inherit;
}

.review-layout {
  display: grid;
  grid-template-columns: minmax(260px, 34%) minmax(360px, 1fr) minmax(240px, 28%);
  gap: 14px;
  align-items: start;
}

.review-queue,
.review-detail,
.review-evidence {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}

.review-queue {
  display: grid;
  max-height: 680px;
  overflow: auto;
}

.review-row {
  display: grid;
  gap: 7px;
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  padding: 14px;
  text-align: left;
  cursor: pointer;
}

.review-row.active,
.review-row:hover {
  background: #eef6fb;
}

.review-row-title {
  color: var(--ink);
  font-weight: 700;
  line-height: 1.25;
}

.review-row-meta {
  color: var(--muted);
  font-size: 0.82rem;
}

.review-row-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.review-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border-radius: 999px;
  padding: 4px 8px;
  background: #edf2f7;
  color: #334155;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-approved,
.status-verified {
  background: #e4f4ed;
  color: #116149;
}

.status-needs_changes,
.severity-high {
  background: #fff1d6;
  color: #8a4b00;
}

.status-rejected {
  background: #ffe8e8;
  color: #9f1d1d;
}

.review-detail,
.review-evidence {
  padding: 18px;
}

.review-detail-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
  margin-bottom: 16px;
}

.review-fields {
  display: grid;
  gap: 12px;
  margin: 0;
}

.review-fields div {
  display: grid;
  gap: 4px;
}

.review-fields dt,
.review-evidence h3 {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
}

.review-fields dd {
  margin: 0;
  color: var(--ink);
  line-height: 1.45;
}

.review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}

.review-evidence ol,
.review-evidence ul {
  display: grid;
  gap: 8px;
  padding-left: 20px;
}

.review-empty {
  padding: 18px;
  color: var(--muted);
}

@media (max-width: 1180px) {
  .review-layout {
    grid-template-columns: 1fr;
  }

  .review-toolbar {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .review-toolbar {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Verify style syntax by serving the app**

Run:

```bash
python3 server.py
```

Open `http://localhost:8000` and check:
- `Review Console` appears in navigation.
- Route filter is hidden on `Review Console`.
- Queue, detail, and evidence chain render without overlap on desktop.
- On a narrow browser width, panels stack vertically.

Stop the server with `Ctrl-C` after verification.

## Task 5: Logs and Final Verification

**Files:**
- Modify: `app/data/update-log.mjs`
- Modify: `mias-cruises-customer-insights-logs/2026-07-21.md`

- [ ] **Step 1: Add Update Log entry**

Add this object at the top of `supervisorLogs` in `app/data/update-log.mjs`:

```javascript
{
  "time": "2026-07-21 02:00",
  "module": "Internal Review Console",
  "change": "Added a standalone internal review page for validation and reflection supervision",
  "reason": "The team needs a practical harness to inspect evidence chains, source limitations, RAG behavior, Mia guardrails, and release hygiene before new agent outputs are surfaced in the dashboard.",
  "scope": "Review Console navigation, seeded log-derived review records, review queue, detail panel, evidence chain, backend review schema and API plan",
  "result": "Internal reviewers can inspect seeded supervision items from the July 16-21 project logs and use the console as the first operational review workspace.",
  "status": "Completed"
},
```

- [ ] **Step 2: Add daily log entry**

Append this section to `mias-cruises-customer-insights-logs/2026-07-21.md`:

```markdown
## Internal Review Console Preparation

- Decision: start with a standalone internal `Review Console` rather than embedding the full supervision workflow inside existing business pages.
- Purpose: supervise validation/reflection results across source collection, data preparation, retrieval/RAG, Mia language guardrails, validation assets, and release hygiene.
- Spec updated: `docs/superpowers/specs/2026-07-21-dfds-internal-review-console-design.md`.
- Plan added: `docs/superpowers/plans/2026-07-21-dfds-internal-review-console.md`.
- Important boundary: existing static dashboard content is not blocked by the new review layer; the review gate applies to new agent-generated outputs and future writebacks.
```

- [ ] **Step 3: Run all local verification commands**

Run:

```bash
python3 -m unittest work/test_review_console.py work/test_server_keywords.py -v
python3 -m py_compile server.py
node --check app/data/review-console.mjs
node --check app/scripts/features/review-console.mjs
node --check app/scripts/features/navigation.mjs
node --check app/app.js
```

Expected: all tests pass and syntax checks exit 0.

- [ ] **Step 4: Final manual smoke test**

Run:

```bash
python3 server.py
```

Open `http://localhost:8000`, then verify:
- `Review Console` is separate from `Update Log`.
- Filters work for layer, status, severity, and search.
- Selecting queue rows updates the detail panel and evidence chain.
- Action buttons update the visible local status for seeded items.
- Existing pages still render.
- `Update Log` still shows the newest item first.

Stop the server with `Ctrl-C`.

## Self-Review

- Spec coverage: schema, API, seeded log-derived review items, queue/detail/evidence chain UI, status actions, Update Log separation, cache-busting, and daily logs are covered.
- Known phase boundary: this first implementation makes status actions update the visible local state for seed items; database persistence is available through the planned API when PostgreSQL is connected.
- Placeholder scan: no unresolved marker text or unspecified implementation steps are left in this plan.
- Type consistency: frontend uses `id`, `title`, `layer`, `status`, `severity`, `route_key`, `reason`, `recommendation`, `publish_state`, `evidence_chain`, and `artifacts`; backend seed items provide the same fields.

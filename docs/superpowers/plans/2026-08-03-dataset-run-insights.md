# Dataset Run Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a cleaned IT or survey upload as an immutable dataset run, then render its aggregate insights and recommendations in the existing application.

**Architecture:** The upload manifest remains the source of ownership and immutable file metadata. A versioned `datasetRun` block and sidecar analysis snapshot add publication, deterministic aggregate analytics, and phase-three-ready events without modifying RAG retrieval. React holds the selected run in URL query state and supplies its analytics snapshot to the Overview and Recommendations routes; public benchmark data remains an explicit alternate source.

**Tech Stack:** Python 3 standard-library HTTP server and JSON manifests; React JSX; browser `fetch`; Node test runner; Python `unittest`.

---

## File Structure

- Modify: `server.py` — manifest run lifecycle, deterministic analytics, owner-scoped endpoints.
- Create: `work/dataset_run.py` — pure lifecycle, schema mapping, aggregate analysis, event-envelope helpers.
- Create: `work/test_dataset_run.py` — focused unit tests for lifecycle, privacy, metrics, and idempotency.
- Create: `work/test_dataset_run_http.py` — endpoint contract tests against the local server helpers.
- Modify: `app/lib/upload-session.mjs` — persisted active dataset-run selection.
- Create: `app/lib/dataset-run.mjs` — query-state and client-side run helpers.
- Create: `app/scripts/services/dataset-run-api.mjs` — publish, list, status, analytics, retry client calls.
- Modify: `app/App.jsx` — global selector, URL state, analytics loading and route props.
- Modify: `app/routes/ITDataFlowRoute.jsx` and `app/routes/SurveyCsvRoute.jsx` — publish and view-insights controls.
- Modify: `app/routes/OverviewRoute.jsx` and `app/routes/RecommendationsRoute.jsx` — selected-run rendering and schema-unavailable state.
- Modify: `app/styles.css` — compact run selector, freshness indicator, and processing/unavailable states.
- Create: `work/test_dataset_run_ui.mjs` — source-level UI contract checks.

### Task 1: Build Pure Dataset-Run Lifecycle and Analysis

**Files:**
- Create: `work/dataset_run.py`
- Create: `work/test_dataset_run.py`

- [ ] **Step 1: Write failing lifecycle and privacy tests**

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from dataset_run import build_analysis_snapshot, publish_run

def test_publish_is_idempotent_and_keeps_published_state_when_analysis_fails():
    manifest = {"batch": {"id": "batch-1", "version": "v1", "ownerId": "u1"}}
    first = publish_run(manifest, owner_id="u1", quality={"cleanedRows": 3, "blockers": []})
    second = publish_run(first, owner_id="u1", quality={"cleanedRows": 3, "blockers": []})
    assert first["batch"]["datasetRun"]["state"] == "published"
    assert first["batch"]["datasetRun"]["publishedAt"] == second["batch"]["datasetRun"]["publishedAt"]

def test_snapshot_excludes_restricted_fields_and_aggregates_rating():
    snapshot = build_analysis_snapshot(
        manifest={"batch": {"id": "batch-1", "version": "v1"}},
        sheets=[{"columns": ["rating", "email"], "previewRows": [{"rating": 4, "email": "a@example.com"}, {"rating": 2, "email": "b@example.com"}], "cleaning": {"cleanedRows": 2}}],
    )
    assert snapshot["metrics"][0]["key"] == "rating"
    assert snapshot["metrics"][0]["value"] == 3.0
    assert "email" not in str(snapshot)
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `cd /Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code && .venv/bin/python -m unittest work/test_dataset_run.py -v`

Expected: import failure because `dataset_run.py` does not exist.

- [ ] **Step 3: Implement the pure contract**

Implement `publish_run(manifest, owner_id, quality)` to initialise `datasetRun` with `state="published"`, `analysisState="not_started"`, ISO timestamps, deterministic `analysisVersion="v1"`, and unchanged values on repeat calls. Implement `build_analysis_snapshot(manifest, sheets)` to recognise `rating`, `nps`, `csat`, `revenue`, `bookings`, `delay`, and `cancellation` columns through a canonical mapping table; calculate only safe aggregates; emit schema availability and a versioned event envelope through `event_envelope(event_type, manifest)`.

- [ ] **Step 4: Run the focused tests and confirm pass**

Run: `cd /Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code && .venv/bin/python -m unittest work/test_dataset_run.py -v`

Expected: all dataset-run unit tests pass.

- [ ] **Step 5: Commit the isolated lifecycle change**

Run: `git add work/dataset_run.py work/test_dataset_run.py && git commit -m "feat: add dataset run lifecycle"`

Expected: commit succeeds when the project is placed in a Git repository; otherwise record that the workspace has no Git metadata.

### Task 2: Expose Owner-Scoped Publish and Analytics APIs

**Files:**
- Modify: `server.py`
- Create: `work/test_dataset_run_http.py`

- [ ] **Step 1: Write failing HTTP contract tests**

```python
class DatasetRunHttpTests(unittest.TestCase):
    def test_publish_rejects_a_batch_owned_by_another_user(self):
        status, payload = publish_dataset_run("batch-other", {"id": "u1"})
        self.assertEqual(status, 403)
        self.assertIn("belongs to another user", payload["error"])

    def test_published_run_returns_a_ready_snapshot(self):
        status, payload = publish_dataset_run("batch-owned", {"id": "u1"})
        self.assertEqual(status, 202)
        status, payload = dataset_run_analytics("batch-owned", {"id": "u1"})
        self.assertEqual(status, 200)
        self.assertEqual(payload["analysisState"], "ready")
        self.assertEqual(payload["batchId"], "batch-owned")
```

- [ ] **Step 2: Run the contract tests and confirm failure**

Run: `cd /Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code && .venv/bin/python -m unittest work/test_dataset_run_http.py -v`

Expected: import failure because the dataset-run server helpers do not exist.

- [ ] **Step 3: Add server helpers and routes**

Add `publish_dataset_run`, `dataset_run_status`, `dataset_run_analytics`, `retry_dataset_run_analysis`, and `list_owned_dataset_runs` to `server.py`. Reuse `require_owned_upload_batch`, `_cleaned_batch_sheets`, and the manifest storage functions. Write the snapshot to the batch folder as `analytics.json`; update the manifest before and after synchronous analysis; append a bounded event envelope to its lifecycle events. Add authenticated routes:

```text
GET  /api/upload-batches
GET  /api/upload-batches/{id}/run-status
GET  /api/upload-batches/{id}/analytics
POST /api/upload-batches/{id}/publish
POST /api/upload-batches/{id}/analysis/retry
```

Return `202` with processing state from publish, `200` plus snapshot when ready, `422` for publish blockers, `403` for another user's batch, and `404` for a missing batch.

- [ ] **Step 4: Run API, schema, and existing upload tests**

Run: `cd /Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code && .venv/bin/python -m unittest work/test_dataset_run_http.py work/test_upload_schema.py work/test_upload_http.py -v`

Expected: all tests pass.

- [ ] **Step 5: Commit the API change**

Run: `git add server.py work/test_dataset_run_http.py && git commit -m "feat: publish upload batches to analytics"`

Expected: commit succeeds when Git metadata is available.

### Task 3: Add Dataset-Run Client State and Selector

**Files:**
- Create: `app/lib/dataset-run.mjs`
- Create: `app/scripts/services/dataset-run-api.mjs`
- Modify: `app/lib/upload-session.mjs`
- Modify: `app/App.jsx`
- Modify: `app/styles.css`
- Create: `work/test_dataset_run_ui.mjs`

- [ ] **Step 1: Write failing UI-state contract tests**

```javascript
assert.match(appSource, /datasetRun/);
assert.match(appSource, /URLSearchParams/);
assert.match(appSource, /Public benchmark/);
assert.match(apiSource, /\/publish/);
assert.match(apiSource, /\/analytics/);
```

- [ ] **Step 2: Run the UI-state test and confirm failure**

Run: `cd /Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code && node work/test_dataset_run_ui.mjs`

Expected: assertion failure because run selection and APIs are absent.

- [ ] **Step 3: Implement URL-backed state and API calls**

In `dataset-run.mjs`, implement `readDatasetRunFromUrl`, `writeDatasetRunToUrl`, and `publicDatasetRun`. In the API service, expose `listDatasetRuns`, `publishDatasetRun`, `getDatasetRunStatus`, `getDatasetRunAnalytics`, and `retryDatasetRunAnalysis`, all with the existing bearer-token header. In `App.jsx`, load the available runs once, update selection from `?datasetRun=`, poll only while `analysisState === "processing"`, and pass `{ activeDatasetRun, datasetAnalytics, datasetAnalyticsState }` to routes. Render a single selector in the top bar for Data Insights and Business Decisions.

- [ ] **Step 4: Run the UI-state test and existing Node tests**

Run: `cd /Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code && node work/test_dataset_run_ui.mjs && node work/test_it_data_flow_upload.mjs`

Expected: both tests pass.

- [ ] **Step 5: Commit the selector state change**

Run: `git add app/App.jsx app/lib/upload-session.mjs app/lib/dataset-run.mjs app/scripts/services/dataset-run-api.mjs app/styles.css work/test_dataset_run_ui.mjs && git commit -m "feat: select published dataset runs"`

Expected: commit succeeds when Git metadata is available.

### Task 4: Publish from Both Intake Workflows

**Files:**
- Modify: `app/routes/ITDataFlowRoute.jsx`
- Modify: `app/routes/SurveyCsvRoute.jsx`
- Modify: `work/test_it_data_flow_upload.mjs`
- Modify: `work/test_dataset_run_ui.mjs`

- [ ] **Step 1: Extend tests with publish UI expectations**

```javascript
assert.match(itRouteSource, /Publish to Insights/);
assert.match(surveyRouteSource, /Publish to Insights/);
assert.match(itRouteSource, /publishDatasetRun/);
assert.match(surveyRouteSource, /publishDatasetRun/);
assert.match(itRouteSource, /View insights/);
```

- [ ] **Step 2: Run the UI tests and confirm failure**

Run: `cd /Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code && node work/test_it_data_flow_upload.mjs && node work/test_dataset_run_ui.mjs`

Expected: assertion failure because no route has a publish action.

- [ ] **Step 3: Implement publish, status, and navigation**

Import `publishDatasetRun` in both routes. After `saveCleanedData` succeeds, display `Publish to Insights`; call publish with the current batch ID, update the application upload session with returned run metadata, and disable the control during request. Render a status line from returned `analysisState`. `View insights` must call `onDatasetRunSelect(run)` then `navigate("/overview")`. Keep the existing MIA upload summary and export behaviour unchanged.

- [ ] **Step 4: Run UI tests**

Run: `cd /Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code && node work/test_it_data_flow_upload.mjs && node work/test_dataset_run_ui.mjs`

Expected: both tests pass.

- [ ] **Step 5: Commit the intake wiring**

Run: `git add app/routes/ITDataFlowRoute.jsx app/routes/SurveyCsvRoute.jsx work/test_it_data_flow_upload.mjs work/test_dataset_run_ui.mjs && git commit -m "feat: publish intake datasets to insights"`

Expected: commit succeeds when Git metadata is available.

### Task 5: Render Run-Scoped Overview and Recommendations

**Files:**
- Modify: `app/routes/OverviewRoute.jsx`
- Modify: `app/routes/RecommendationsRoute.jsx`
- Modify: `app/styles.css`
- Modify: `work/test_dataset_run_ui.mjs`

- [ ] **Step 1: Add failing run-rendering tests**

```javascript
assert.match(overviewSource, /datasetAnalytics/);
assert.match(overviewSource, /Dataset analysis is still processing/);
assert.match(overviewSource, /This uploaded schema does not support/);
assert.match(recommendationsSource, /datasetAnalytics/);
assert.match(recommendationsSource, /analysisVersion/);
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `cd /Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code && node work/test_dataset_run_ui.mjs`

Expected: assertion failure because routes only read seeded public data.

- [ ] **Step 3: Implement deterministic run views**

For a selected uploaded run, Overview renders snapshot metric cards, segment distributions, quality context, and insight facts. Recommendations renders only snapshot recommendations with priority, evidence/calculation fields, `batchId`, `version`, and `analysisVersion`. If analysis is processing, both render the same stable processing state. If the required metric/dimension is unavailable, render an explicit schema-unavailable state and never fall back to public seeded values. Preserve the existing route rendering only when `activeDatasetRun.kind === "public"`.

- [ ] **Step 4: Run the complete focused suite**

Run: `cd /Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code && .venv/bin/python -m unittest work/test_dataset_run.py work/test_dataset_run_http.py work/test_upload_schema.py work/test_upload_http.py -v && node work/test_dataset_run_ui.mjs && node work/test_it_data_flow_upload.mjs`

Expected: all Python and Node tests pass.

- [ ] **Step 5: Run the manual smoke flow**

Run: `cd /Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code && PORT=8768 .venv/bin/python server.py`

Expected: upload an IT workbook and a survey, save and publish each, observe a ready analysis state, open Overview and Recommendations with `?datasetRun=<batch-id>`, then choose `Public benchmark` and see only the seeded public dashboard.

- [ ] **Step 6: Commit the run-scoped dashboard**

Run: `git add app/routes/OverviewRoute.jsx app/routes/RecommendationsRoute.jsx app/styles.css work/test_dataset_run_ui.mjs && git commit -m "feat: render insights from dataset runs"`

Expected: commit succeeds when Git metadata is available.

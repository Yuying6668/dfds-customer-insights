# IT Data Flow Six-Stage Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the IT Data Flow lifecycle into a real, auditable upload-to-Mia pipeline.

**Architecture:** The Python upload service will attach validation, classification, mapping, cleaning, and review results to each persisted batch manifest without altering immutable originals. The React route will render those backend-owned stage results and use the mapped rows for preview, export, and Mia context.

**Tech Stack:** Python 3, openpyxl, React, Vite, unittest.

---

### Task 1: Define Six-Stage Batch Contract

**Files:**
- Modify: `backend/upload_ingest.py`
- Test: `work/test_upload_ingest.py`

- [ ] **Step 1: Write failing tests**

```python
def test_prepared_batch_records_all_six_lifecycle_stages(self):
    batch = upload_ingest.prepare_batch([(workbook.name, workbook.read_bytes())], self.storage_root)
    self.assertEqual([stage["key"] for stage in batch["batch"]["lifecycle"]], [
        "upload", "validate", "classify", "map", "review", "ready_for_mia"
    ])
```

- [ ] **Step 2: Run the focused test**

Run: `.venv/bin/python -m unittest work.test_upload_ingest.UploadIngestTests.test_prepared_batch_records_all_six_lifecycle_stages`

Expected: FAIL because lifecycle metadata is absent.

- [ ] **Step 3: Implement lifecycle metadata**

```python
batch["lifecycle"] = build_lifecycle_summary(profile_files)
```

- [ ] **Step 4: Run the focused test**

Run: `.venv/bin/python -m unittest work.test_upload_ingest.UploadIngestTests.test_prepared_batch_records_all_six_lifecycle_stages`

Expected: PASS.

### Task 2: Standardize Business Fields

**Files:**
- Modify: `backend/upload_ingest.py`
- Test: `work/test_upload_ingest.py`

- [ ] **Step 1: Write failing tests**

```python
def test_cleaned_rows_standardize_route_date_amount_and_rating(self):
    cleaned = upload_ingest.clean_sheet_rows(rows)
    self.assertEqual(cleaned["previewRows"][0]["route"], "Dover-Calais")
    self.assertEqual(cleaned["previewRows"][0]["travel_date"], "2026-02-20")
    self.assertEqual(cleaned["previewRows"][0]["gross_amount"], "113.15 EUR")
    self.assertEqual(cleaned["previewRows"][0]["rating"], "4.0")
```

- [ ] **Step 2: Run the focused test**

Run: `.venv/bin/python -m unittest work.test_upload_ingest.UploadIngestTests.test_cleaned_rows_standardize_route_date_amount_and_rating`

Expected: FAIL because values are currently only trimmed.

- [ ] **Step 3: Implement deterministic normalizers**

```python
row = standardize_row(row)
```

- [ ] **Step 4: Run the focused test**

Run: `.venv/bin/python -m unittest work.test_upload_ingest.UploadIngestTests.test_cleaned_rows_standardize_route_date_amount_and_rating`

Expected: PASS.

### Task 3: Render Backend Stage Results

**Files:**
- Modify: `app/routes/ITDataFlowRoute.jsx`
- Modify: `app/routes/it-data-flow-state.mjs`
- Test: `work/test_it_data_flow_state.mjs`

- [ ] **Step 1: Write failing state test**

```javascript
assert.equal(getLifecycleStages(batch.lifecycle)[5].state, "complete");
```

- [ ] **Step 2: Run test**

Run: `node --test work/test_it_data_flow_state.mjs`

Expected: FAIL because the lifecycle uses file count rather than backend stage results.

- [ ] **Step 3: Render stage count and result**

```jsx
{getLifecycleStages(uploadedBatch.batch.lifecycle).map((stage) => <LifecycleStage key={stage.key} {...stage} />)}
```

- [ ] **Step 4: Run test**

Run: `node --test work/test_it_data_flow_state.mjs`

Expected: PASS.

### Task 4: Verify and Record

**Files:**
- Modify: `mias-cruises-customer-insights-logs/2026-07-29.md`

- [ ] **Step 1: Run regression tests**

Run: `.venv/bin/python -m unittest work.test_upload_ingest work.test_mia_response_structure && node --test work/test_it_data_flow_state.mjs`

Expected: PASS.

- [ ] **Step 2: Perform rendered verification**

Upload the existing booking workbook and confirm the lifecycle shows real counts, mapped route values, and a Ready for Mia result.

- [ ] **Step 3: Record implementation in daily log**

```markdown
## IT Data Flow six-stage execution
- Added backend-backed validation, classification, mapping, review, and Ready for Mia stage results.
```

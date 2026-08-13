# IT Data Flow Upload and Clean Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator drag real Excel files into IT Data Flow, persist and profile the batch, then inspect a deterministic cleaned Excel preview below the source workbook preview.

**Architecture:** A focused Python ingestion module owns safe file validation, immutable storage, spreadsheet profiling, deterministic cleaning, and JSON-ready results. `server.py` exposes a small multipart API and persistence boundary. React owns the drag interaction and renders only the backend's returned preview; it never claims browser-local selection is processed data.

**Tech Stack:** React 19, Vite, Python 3.14 stdlib HTTP server, PostgreSQL/pgvector when available, `openpyxl`, Node `assert`, Python `unittest`.

---

## Repository Note

`/Users/irene/Documents/Codex/2026-07-16/product-architecture-before-writing-any-code` has no `.git` metadata. Use the test and build checkpoints below in place of commits; do not create a synthetic Git repository.

## File Structure

- Create: `backend/upload_ingest.py` - validation, Excel/CSV profiling, deterministic cleaning, secure local storage, and JSON manifests.
- Create: `work/test_upload_ingest.py` - behavior tests for workbook cleaning and unsupported documents.
- Create: `work/test_upload_schema.py` - schema contract checks for batch lineage tables.
- Create: `app/scripts/services/upload-batch-api.mjs` - browser `FormData` upload client.
- Create: `work/test_it_data_flow_upload.mjs` - client utility and UI source-contract tests.
- Modify: `backend/requirements.txt` - pin `openpyxl`.
- Modify: `db/schema.sql` - add upload batch, file, sheet, and event tables/indexes.
- Modify: `server.py` - multipart parser, batch endpoints, local/PG persistence boundary, and protected response serialization.
- Modify: `app/data/platform-architecture.mjs` - accept spreadsheet source formats.
- Modify: `app/routes/it-data-flow-state.mjs` - accepted type, queue, and cleaned sheet selection helpers.
- Modify: `app/routes/ITDataFlowRoute.jsx` - accessible drop target, upload states, and backend-cleaned Excel preview below the existing source table.
- Modify: `app/styles.css` - compact drag-active, upload-state, and cleaned-preview styles with responsive overflow.

### Task 1: Define the Ingestion Contract With Failing Tests

**Files:**
- Create: `work/test_upload_ingest.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Write the failing workbook-cleaning test**

```python
def test_profile_xlsx_cleans_headers_blank_rows_and_exact_duplicates(self):
    workbook_path = self.make_workbook([
        (" Booking ID ", "Route", "Route"),
        (" B-1001 ", "Dover-Calais", "Dover-Calais"),
        (None, None, None),
        ("B-1001", "Dover-Calais", "Dover-Calais"),
        ("B-1002", "Newcastle-IJmuiden", "Newcastle-IJmuiden"),
    ])
    profile = upload_ingest.profile_uploaded_file(workbook_path, "sample.xlsx")
    sheet = profile["sheets"][0]
    self.assertEqual(sheet["columns"], ["booking_id", "route", "route_2"])
    self.assertEqual(sheet["cleaning"]["blankRowsRemoved"], 1)
    self.assertEqual(sheet["cleaning"]["duplicateRowsRemoved"], 1)
    self.assertEqual(sheet["previewRows"], [{"booking_id": "B-1001", "route": "Dover-Calais", "route_2": "Dover-Calais"}, {"booking_id": "B-1002", "route": "Newcastle-IJmuiden", "route_2": "Newcastle-IJmuiden"}])
```

- [ ] **Step 2: Run the test and verify it fails because the module does not exist**

Run: `python3 -m unittest work/test_upload_ingest.py -v`

Expected: `ModuleNotFoundError: No module named 'backend.upload_ingest'`.

- [ ] **Step 3: Add the parser dependency**

```text
openpyxl>=3.1,<3.2
```

Append the line to `backend/requirements.txt`. Install it in the local virtual environment before rerunning Python tests.

- [ ] **Step 4: Add the minimal profile and cleaning implementation**

```python
def normalize_header(value, index, used):
    base = re.sub(r"[^\\w]+", "_", str(value or "").strip().casefold(), flags=re.UNICODE).strip("_") or f"column_{index + 1}"
    candidate = base
    suffix = 2
    while candidate in used:
        candidate = f"{base}_{suffix}"
        suffix += 1
    used.add(candidate)
    return candidate

def clean_sheet_rows(rows):
    row_iterator = iter(rows)
    headers = next(row_iterator, ())
    used_headers = set()
    columns = [normalize_header(value, index, used_headers) for index, value in enumerate(headers)]
    cleaned_rows = []
    signatures = set()
    blank_rows_removed = 0
    duplicate_rows_removed = 0
    received_rows = 0
    for raw_values in row_iterator:
        received_rows += 1
        values = list(raw_values) + [None] * max(0, len(columns) - len(raw_values))
        row = {
            column: value.isoformat() if isinstance(value, (date, datetime)) else value.strip() if isinstance(value, str) else "" if value is None else value
            for column, value in zip(columns, values)
        }
        if not any(value != "" for value in row.values()):
            blank_rows_removed += 1
            continue
        signature = json.dumps(row, sort_keys=True, ensure_ascii=False, default=str)
        if signature in signatures:
            duplicate_rows_removed += 1
            continue
        signatures.add(signature)
        cleaned_rows.append(row)
    return {
        "columns": columns,
        "dataRows": received_rows,
        "previewRows": cleaned_rows[:50],
        "cleaning": {
            "receivedRows": received_rows,
            "cleanedRows": len(cleaned_rows),
            "blankRowsRemoved": blank_rows_removed,
            "duplicateRowsRemoved": duplicate_rows_removed,
            "previewRows": min(len(cleaned_rows), 50),
        },
    }

def profile_uploaded_file(path, original_name):
    suffix = Path(original_name).suffix.casefold()
    profile = {"name": original_name, "parserState": "received_unparsed", "sheets": []}
    if suffix == ".xlsx":
        workbook = openpyxl.load_workbook(path, read_only=True, data_only=False)
        profile["parserState"] = "profiled"
        profile["sheets"] = [
            {"name": worksheet.title, **clean_sheet_rows(worksheet.iter_rows(values_only=True))}
            for worksheet in workbook.worksheets
        ]
        workbook.close()
    elif suffix in {".csv", ".txt"}:
        with Path(path).open("r", encoding="utf-8-sig", newline="") as source:
            profile["parserState"] = "profiled"
            profile["sheets"] = [{"name": Path(original_name).stem, **clean_sheet_rows(csv.reader(source))}]
    return profile
```

Use `openpyxl.load_workbook(path, read_only=True, data_only=False)`. Do not evaluate formulas or execute macros.

- [ ] **Step 5: Run the ingestion test and verify it passes**

Run: `python3 -m unittest work/test_upload_ingest.py -v`

Expected: all profile and cleaning tests pass.

### Task 2: Add Safe Storage and Non-Spreadsheet Behavior

**Files:**
- Modify: `work/test_upload_ingest.py`
- Modify: `backend/upload_ingest.py`

- [ ] **Step 1: Write failing validation tests**

```python
def test_prepare_batch_rejects_empty_and_unsupported_files(self):
    with self.assertRaisesRegex(upload_ingest.UploadValidationError, "Unsupported file type"):
        upload_ingest.prepare_batch([("unsafe.exe", b"x")], self.storage_root)
    with self.assertRaisesRegex(upload_ingest.UploadValidationError, "empty"):
        upload_ingest.prepare_batch([("empty.xlsx", b"")], self.storage_root)

def test_prepare_batch_marks_docx_as_received_unparsed(self):
    batch = upload_ingest.prepare_batch([("note.docx", b"not parsed")], self.storage_root)
    self.assertEqual(batch["files"][0]["parserState"], "received_unparsed")
    self.assertEqual(batch["files"][0]["sheets"], [])
```

- [ ] **Step 2: Run the tests and verify expected failure**

Run: `python3 -m unittest work/test_upload_ingest.py -v`

Expected: missing `prepare_batch` or incorrect parser-state assertions.

- [ ] **Step 3: Implement bounded, immutable batch storage**

```python
ALLOWED_SUFFIXES = {".xlsx", ".csv", ".txt", ".pdf", ".docx"}
MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_BATCH_FILES = 10

def prepare_batch(files, storage_root, batch_id=None):
    if not files or len(files) > MAX_BATCH_FILES:
        raise UploadValidationError("Upload one to ten files per batch")
    staged = []
    checksums = set()
    for original_name, payload in files:
        suffix = Path(original_name).suffix.casefold()
        if suffix not in ALLOWED_SUFFIXES:
            raise UploadValidationError(f"Unsupported file type: {suffix or 'unknown'}")
        if not payload:
            raise UploadValidationError(f"File is empty: {original_name}")
        if len(payload) > MAX_FILE_BYTES:
            raise UploadValidationError(f"File exceeds 10 MB: {original_name}")
        checksum = hashlib.sha256(payload).hexdigest()
        if checksum in checksums:
            raise UploadValidationError(f"Duplicate file in batch: {original_name}")
        checksums.add(checksum)
        staged.append((original_name, suffix, payload, checksum))
    batch_id = batch_id or str(uuid.uuid4())
    original_dir = Path(storage_root) / batch_id / "original"
    original_dir.mkdir(parents=True, exist_ok=False)
    files_result = []
    for original_name, suffix, payload, checksum in staged:
        file_id = str(uuid.uuid4())
        stored_path = original_dir / f"{file_id}{suffix}"
        stored_path.write_bytes(payload)
        profile = profile_uploaded_file(stored_path, original_name)
        files_result.append({"id": file_id, "checksum": checksum, "sizeBytes": len(payload), **profile})
    batch = {
        "id": batch_id,
        "state": "ready_for_validation",
        "fileCount": len(files_result),
        "profiledRowCount": sum(sheet["dataRows"] for item in files_result for sheet in item["sheets"]),
        "totalBytes": sum(item["sizeBytes"] for item in files_result),
    }
    manifest = {"batch": batch, "files": files_result}
    (original_dir.parent / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest
```

Use SHA-256 to reject duplicate file bytes inside one batch. Store generated file names, never a user-controlled path.

- [ ] **Step 4: Run the ingestion suite**

Run: `python3 -m unittest work/test_upload_ingest.py -v`

Expected: workbook, validation, duplicate, and document-state tests pass.

### Task 3: Persist Upload Lineage and Expose the HTTP API

**Files:**
- Create: `work/test_upload_schema.py`
- Modify: `db/schema.sql`
- Modify: `server.py`

- [ ] **Step 1: Write the failing schema test**

```python
for table_name in ("upload_batches", "uploaded_files", "uploaded_file_sheets", "upload_batch_events"):
    self.assertIn(f"CREATE TABLE IF NOT EXISTS {table_name}", schema)
self.assertIn("cleaning_summary JSONB", schema)
self.assertIn("preview_rows JSONB", schema)
```

- [ ] **Step 2: Run the schema test and verify it fails**

Run: `python3 -m unittest work/test_upload_schema.py -v`

Expected: missing upload-table assertion.

- [ ] **Step 3: Add additive PostgreSQL tables and indexes**

```sql
CREATE TABLE IF NOT EXISTS upload_batches (
  id UUID PRIMARY KEY,
  owner_scope TEXT NOT NULL,
  state TEXT NOT NULL,
  file_count INTEGER NOT NULL,
  profiled_row_count INTEGER NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL,
  manifest_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Add child tables for immutable files, sheet metadata/preview JSON, and batch events. Add indexes on owner scope plus creation time and on `uploaded_files(batch_id)`.

- [ ] **Step 4: Add testable multipart and persistence functions to `server.py`**

```python
def parse_multipart_upload(content_type, body):
    if "multipart/form-data" not in content_type.casefold():
        raise UploadValidationError("Expected multipart/form-data")
    envelope = (
        f"Content-Type: {content_type}\\r\\nMIME-Version: 1.0\\r\\n\\r\\n".encode("utf-8")
        + body
    )
    message = BytesParser(policy=default).parsebytes(envelope)
    files = []
    for part in message.iter_parts():
        disposition = part.get_content_disposition()
        field_name = part.get_param("name", header="content-disposition")
        filename = part.get_filename()
        if disposition == "form-data" and field_name == "files" and filename:
            files.append((filename, part.get_payload(decode=True) or b""))
    if not files:
        raise UploadValidationError("No files were supplied")
    return files

def create_upload_batch(file_parts, owner_scope="local-demo"):
    manifest = upload_ingest.prepare_batch(file_parts, UPLOAD_BATCH_ROOT)
    conn = connect_db()
    if conn is not None:
        try:
            persist_upload_manifest(conn, manifest, owner_scope)
            manifest["persistence"] = "postgresql"
        finally:
            conn.close()
    else:
        manifest["persistence"] = "filesystem_only"
    return manifest
```

Add `POST /api/upload-batches` and `GET /api/upload-batches/<batch-id>` before the existing `/api/chat` branch. Return `400` for invalid input, `413` for excessive content, and `201` for a created batch.

- [ ] **Step 5: Run schema and server source tests**

Run: `python3 -m unittest work/test_upload_schema.py work/test_upload_ingest.py -v`

Expected: all tests pass.

### Task 4: Add Upload Client and Pure Frontend State Tests

**Files:**
- Create: `app/scripts/services/upload-batch-api.mjs`
- Create: `work/test_it_data_flow_upload.mjs`
- Modify: `app/routes/it-data-flow-state.mjs`
- Modify: `app/data/platform-architecture.mjs`

- [ ] **Step 1: Write the failing Node test**

```javascript
assert.equal(isAcceptedUploadFile({ name: "booking.xlsx" }), true);
assert.equal(isAcceptedUploadFile({ name: "payload.exe" }), false);
assert.deepEqual(getFirstCleanedSheet({ files: [{ sheets: [{ name: "Bookings" }] }] }), {
  fileIndex: 0,
  sheetIndex: 0
});
```

- [ ] **Step 2: Run the Node test and verify it fails**

Run: `node work/test_it_data_flow_upload.mjs`

Expected: import/export failure for the missing helper.

- [ ] **Step 3: Implement the client boundary and pure helpers**

```javascript
export async function uploadBatch(files) {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  const response = await fetch("/api/upload-batches", { method: "POST", body });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Upload failed");
  return payload;
}
```

Add `.xlsx` and `.csv` to `acceptedFormats`. Keep file type and cleaned-sheet selection logic in `it-data-flow-state.mjs`, not inside the React component.

- [ ] **Step 4: Run the Node test and existing IT Flow state test**

Run: `node work/test_it_data_flow_upload.mjs && node work/test_it_data_flow_state.mjs`

Expected: both report success.

### Task 5: Implement Accessible Drag Upload and the Cleaned Excel Preview

**Files:**
- Modify: `app/routes/ITDataFlowRoute.jsx`
- Modify: `app/styles.css`
- Modify: `work/test_it_data_flow_upload.mjs`

- [ ] **Step 1: Extend the failing source contract test**

```javascript
assert.match(routeSource, /onDragOver/);
assert.match(routeSource, /onDrop/);
assert.match(routeSource, /uploadBatch\(queuedFiles\)/);
assert.match(routeSource, /Cleaned Excel preview/);
assert.match(routeSource, /blankRowsRemoved/);
assert.match(routeSource, /duplicateRowsRemoved/);
assert.match(css, /\.upload-drop-zone\s*\{/);
assert.match(css, /\.cleaned-workbook-preview\s*\{/);
```

- [ ] **Step 2: Run the source contract test and verify it fails**

Run: `node work/test_it_data_flow_upload.mjs`

Expected: missing drag/drop and cleaned preview assertions.

- [ ] **Step 3: Add the route behavior**

```jsx
const onDrop = (event) => {
  event.preventDefault();
  setDragActive(false);
  queueFiles(Array.from(event.dataTransfer.files || []));
};

const submitBatch = async () => {
  setUploadState("uploading");
  try {
    const result = await uploadBatch(queuedFiles);
    setUploadedBatch(result);
    setUploadState("success");
  } catch (error) {
    setUploadError(error.message);
    setUploadState("error");
  }
};
```

Render an actual drop zone with `onDragEnter`, `onDragOver`, `onDragLeave`, and `onDrop`, while keeping the hidden native input and visible button. Render the cleaned panel only when the API returned profiled sheets. Use a file `<select>` and worksheet tabs, then render the selected sheet's returned columns and `previewRows` with `DataTable` directly below the existing source preview.

- [ ] **Step 4: Add responsive styles**

```css
.upload-drop-zone { border: 1px dashed var(--cyan); }
.upload-drop-zone.drag-active { border-color: var(--blue); background: #eef5f8; }
.cleaned-workbook-preview { border-top: 3px solid var(--green); }
```

Keep tables horizontally scrollable inside `.table-wrap`; do not let the drag target or controls resize on hover.

- [ ] **Step 5: Run frontend tests and production build**

Run: `node work/test_it_data_flow_upload.mjs && node work/test_it_data_flow_state.mjs && pnpm build`

Expected: both test commands print their pass message and Vite completes without errors.

### Task 6: Execute a Real Workbook Smoke Test

**Files:**
- Modify: `work/test_upload_ingest.py`
- Modify: `work/test_it_data_flow_upload.mjs`

- [ ] **Step 1: Add an end-to-end fixture assertion**

```python
def test_fixture_batch_reports_all_profiled_rows(self):
    batch = upload_ingest.prepare_batch(self.fixture_workbooks(), self.storage_root)
    self.assertEqual(batch["batch"]["profiledRowCount"], 1280)
    self.assertEqual(batch["batch"]["fileCount"], 3)
```

Use the three source-workbook paths from the generated IT Data Flow demo only when they exist; the test otherwise creates a local deterministic fixture and explains that the external fixture was unavailable.

- [ ] **Step 2: Run complete verification**

Run: `python3 -m unittest work/test_upload_ingest.py work/test_upload_schema.py -v && node work/test_it_data_flow_upload.mjs && node work/test_it_data_flow_state.mjs && pnpm build`

Expected: all automated checks pass.

- [ ] **Step 3: Run the server and inspect the browser behavior**

Run: `PORT=8767 .venv/bin/python -u server.py`

Expected: `Mia's Cruises dashboard: http://127.0.0.1:8767/`. Open `/it-data-flow`, drag all three fixture workbooks, select Upload batch, and confirm that the Cleaned Excel preview appears below the source workbook preview with non-zero cleaning statistics.

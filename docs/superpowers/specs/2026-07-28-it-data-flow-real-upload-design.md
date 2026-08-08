# DFDS IT Data Flow Real Upload Design

## Goal

Turn the existing IT Data Flow file chooser into a real batch-ingestion entry
point. A user can drag files onto the page or choose them with the keyboard,
the browser uploads the batch to the backend, and the UI shows the persisted
batch, file versions, spreadsheet structure, and validation readiness.

The existing synthetic Excel workbooks are the first acceptance fixture:

- `booking_payment_export_v4.xlsx`
- `crm_loyalty_snapshot.xlsx`
- `voice_and_operations_batch.xlsx`

The feature must not present a local browser-only preview as a stored upload or
claim that a PDF or Word document has been parsed when it has only been
received.

## Scope

### Frontend

- A keyboard-accessible drag-and-drop target on `/it-data-flow` plus the
  existing file picker as the fallback.
- Accept `.xlsx`, `.csv`, `.txt`, `.pdf`, and `.docx`; reject unsupported
  extensions before upload.
- Queue display with filename, format, size, upload state, and remove/retry
  controls.
- Upload progress and server-provided error messages.
- Persisted batch summary after a successful request: batch ID, version time,
  source checksum, file count, spreadsheet sheet count, profiled-row count,
  and processing state.
- A compact Mia intake brief populated only from backend response metadata.
- A "Cleaned Excel preview" directly below the existing source-workbook table.
  It uses the server-returned cleaned rows, shows a selected uploaded workbook
  and worksheet, and labels the preview row limit and cleaning changes.

### Backend

- `POST /api/upload-batches` receives `multipart/form-data`.
- Validate content length, file count, extension, non-empty file, and duplicate
  checksum before storing a file.
- Create a UUID batch and immutable original-file directory under
  `data/upload_batches/<batch_id>/original/`.
- Store a SHA-256 checksum, original name, safe stored name, MIME type, size,
  received time, parser state, and owner scope.
- Profile `.xlsx` with `openpyxl` in read-only, formula-safe mode: workbook
  sheet names, headers, and data-row count. Profile `.csv` and `.txt` with
  bounded standard-library readers.
- Add a pinned `openpyxl` dependency to the backend image so the uploaded
  workbook behavior matches local development and deployment.
- Accept PDF and DOCX as controlled attachments with parser state
  `received_unparsed`. They are visible and versioned but do not generate
  inferred dimensions or Mia evidence until a dedicated extractor is added.
- Return only the batch metadata required by the UI. Original files are not
  made public through static file hosting.

### Deterministic Cleaning Preview

For XLSX and CSV sources, the upload service derives a bounded display preview
without modifying the immutable original file. The first release applies only
explainable rules:

1. trim header and text-cell whitespace;
2. normalize duplicate or blank headers into stable unique display names;
3. convert dates and datetimes to ISO strings;
4. drop wholly blank rows;
5. remove exact duplicate cleaned rows;
6. retain the first 50 cleaned rows for the UI.

The service returns counts for received rows, cleaned rows, blank rows removed,
duplicate rows removed, and preview rows. It does not infer business values,
rewrite identifiers, or publish cleaned rows to Mia. Restricted identity
columns are masked in the API preview before they leave the server.

### Date And Time Standardisation

The cleaning service recognizes explicit date/time fields and common normalized
date headers, including `date`, `booking_date`, and `response_date`. It accepts
unambiguous day-first values in `dd/mm/yyyy` form and converts valid values to
UTC ISO-8601, for example `20/02/2026` becomes `2026-02-20T00:00:00Z`.

Calendar validity is always checked. A value such as `31/02/2026` is not
silently corrected or discarded: the original value remains in the cleaned
row, increments the `Invalid dates` quality check, and is recorded as an
`Invalid date` mapping exception. The Exceptions / Expectations review view
must expose the source worksheet, field, original value, reason, and affected
row so that a user can resolve it manually. Time-zone-bearing values are
normalized to UTC and retain a generated `timezone` field that records the
source offset or UTC marker.

## Data Model

The following tables are additive. Existing passenger-profile and evidence
tables remain unchanged.

| Table | Purpose |
| --- | --- |
| `upload_batches` | batch ID, owner scope, received time, state, total size, and source version |
| `uploaded_files` | one immutable source file, checksum, parser status, format, location, and error detail |
| `uploaded_file_sheets` | Excel sheet name, header columns, data-row count, cleaning summary, masked preview rows, and schema fingerprint |
| `upload_batch_events` | received, profiled, validation-ready, failed, and reviewed audit events |

The database records metadata and lineage. Disk storage holds the original
binary file under a generated name, never under a user-controlled path.

## Processing States

```text
queued -> uploading -> received -> profiled -> ready_for_validation
                         \-> received_unparsed
                         \-> rejected | failed
```

`ready_for_validation` means the source was accepted and structurally profiled;
it does not mean its rows were cleaned, approved, or made available to Mia.

## API Contract

### Request

`POST /api/upload-batches` uses multipart form data with a `files` field and
an optional existing conversation ID for UI association. Server-side identity
supplies the owner scope when authentication is available.

Limits for the demo are 10 files, 10 MB per file, and 30 MB per batch. The
handler returns a clear error before persistence when any limit fails.

### Response

```json
{
  "batch": {
    "id": "uuid",
    "state": "ready_for_validation",
    "fileCount": 3,
    "profiledRowCount": 1280,
    "totalBytes": 102400,
    "receivedAt": "2026-07-28T12:00:00Z"
  },
  "files": [
    {
      "id": "uuid",
      "name": "booking_payment_export_v4.xlsx",
      "checksum": "sha256...",
      "parserState": "profiled",
      "sheets": [
        {
          "name": "Bookings",
          "dataRows": 340,
          "cleaning": {"blankRowsRemoved": 2, "duplicateRowsRemoved": 1},
          "columns": ["booking_id", "route"],
          "previewRows": [{"booking_id": "B-1001", "route": "Dover-Calais"}]
        }
      ]
    }
  ]
}
```

## Safety and Truthfulness

- File extensions are checked before persistence; generated storage names use
  UUIDs and cannot traverse directories.
- Spreadsheet formulas are never evaluated. Workbook parsing uses read-only
  values and does not execute macros.
- Files are not indexed into Mia automatically. Only a reviewed, validated
  downstream output may enter the evidence or memory pipeline.
- The UI labels PDF/DOCX uploads as received but unparsed. It does not claim
  content, schema, or quality information for them.
- The demo does not provide malware scanning; that limitation is explicit in
  the technical record rather than hidden.

## Acceptance Tests

1. Dragging all three fixture workbooks queues them and sends one batch.
2. The server returns three persisted file records and the expected workbook
   names, sheet counts, and source checksums.
3. An unsupported extension, empty file, excessive file, and duplicate file
   produce meaningful errors without creating a valid batch record.
4. A PDF or DOCX is stored with `received_unparsed`, not a fabricated preview.
5. A cleaned Excel preview shows normalized headers and rows below the source
   workbook preview, with visible blank-row and duplicate-row removal counts.
6. A page reload can retrieve the submitted batch metadata by authorized owner
   scope.
7. The production React build succeeds and the drag target remains usable with
   keyboard file selection on desktop and mobile.

## Delivery Boundary

This release ends at source receipt and structural profiling. The later
Validate, Classify, Map, Review, and Ready for Mia stages will consume the
persisted batch through explicit backend jobs; they are not cosmetically
advanced by the upload action alone.

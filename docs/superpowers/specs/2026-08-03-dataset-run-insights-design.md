# Dataset Run Insights and Decisions Design

## Objective

Make each IT Data Flow or Survey upload a governed, versioned dataset run. Once its six intake steps are complete and the run is published, Data Insights and Business Decisions must show analysis derived from that same run, rather than only from the seeded public-data view.

## Scope

This is the first stage of the recommended versioned-data approach. It supports manually uploaded CSV/XLS/XLSX data and keeps the existing public dashboard as a comparison baseline. It does not introduce streaming ingestion, scheduled refresh, or automatic business actions.

## Design Decisions

- The existing upload batch ID becomes the dataset-run identity. A separate identifier is not needed.
- A batch is immutable after publishing. A new upload always creates a new run.
- The run becomes visible in downstream analytics only after an explicit publish action and passing minimum quality checks.
- Numeric and categorical analysis uses the cleaned batch data and deterministic aggregate calculations. It does not depend on RAG.
- RAG indexing is optional, asynchronous, and limited to approved free-text fields plus dataset metadata. Its status never blocks publishing or dashboard analysis.
- Every result returned by downstream APIs includes `batchId`, `version`, `generatedAt`, and quality metadata so it is traceable.
- Publishing is idempotent: repeating a publish request for the same unchanged batch returns its existing run state and never creates a second analytical version.
- Publication state and analysis state are independent. A run may be published while analysis is processing or has failed; it never becomes unpublished merely because an analysis job failed.

## Data Model

Extend each stored batch manifest with a `datasetRun` object:

```json
{
  "state": "draft | published",
  "publishedAt": "ISO-8601 timestamp or null",
  "publishedBy": "authenticated user id or null",
  "analysisState": "not_started | processing | ready | failed",
  "analysisGeneratedAt": "ISO-8601 timestamp or null",
  "ragState": "not_requested | queued | ready | failed",
  "quality": {
    "cleanedRows": 0,
    "mappingExceptions": 0,
    "invalidValues": 0,
    "readyToPublish": false
  },
  "lineage": {
    "sourceType": "it_data | survey",
    "rawFileHashes": ["sha256"],
    "standardisationVersion": "version",
    "schemaFingerprint": "versioned hash",
    "analysisVersion": "version"
  }
}
```

Persist an analysis snapshot alongside the uploaded batch. The snapshot contains only safe aggregates and derived results:

- dataset overview: record count, time range, sources, markets, routes, languages;
- quality summary and field coverage;
- metric cards selected from recognised fields, such as rating, NPS, CSAT, revenue, bookings, delays, and cancellation rate;
- distributions and route/market segments where fields exist;
- deterministic anomalies: threshold breaches and statistically material changes when a comparable previous run exists;
- evidence-backed insight facts, each with its calculation inputs;
- suggested decisions, derived from the insight facts and labelled as recommendations, never as automatic actions.

No raw PII or unrestricted row contents are stored in this snapshot.

### Semantic Mapping Contract

The current column-name heuristics are sufficient for preview, but not for reliable downstream analysis. Add a versioned mapping registry that maps source fields to canonical concepts and declares each concept's data type, allowed dimensions, privacy level, and aggregation rule. For example, `overall_score` may map to `rating` with an average aggregation; `response_at` maps to a time dimension; `free_text` is restricted and eligible for optional RAG only when explicitly approved. An unknown column is retained in cleaned output but cannot produce a metric or a business decision.

Publish eligibility uses source-type-specific rules. Fatal errors block publishing; mapping exceptions and null values may be warnings where the known metric definitions remain valid. The returned quality object must state the exact blockers and warnings.

## Processing Flow

```text
Upload -> parse -> validate -> map -> clean -> standardise -> quality check
  -> explicit publish -> aggregate analysis -> insights and decisions ready
                         \
                          -> optional RAG indexing of approved text and metadata
```

The existing `POST /api/upload-batches/{id}/save-cleaned` endpoint continues to persist cleaned output. Add an explicit publish endpoint which verifies ownership and quality, marks the run published, then starts analysis. For the current local application the analysis can run in the same process after publication. Its API contract must be job-shaped so it can later move to a worker queue without changing the UI.

The first version uses polling, but every state transition also emits a durable domain event through one internal publisher function:

```text
dataset-run.created
dataset-run.cleaned
dataset-run.published
dataset-run.analysis-requested
dataset-run.analysis-ready
dataset-run.analysis-failed
dataset-run.rag-requested
dataset-run.rag-ready
```

In phase one the publisher may write the event to the batch manifest or a local append-only event log. Its payload is a small, versioned envelope containing `eventId`, `eventType`, `occurredAt`, `batchId`, `ownerId`, `sourceType`, `schemaFingerprint`, and `analysisVersion`; it must not include raw rows or PII. This boundary is the intentional bridge to solution three: a future outbox plus queue/stream consumer can consume the exact same events without changing the intake, dashboard, or decision contracts.

## APIs

Add authenticated, owner-scoped endpoints:

| Endpoint | Behaviour |
| --- | --- |
| `POST /api/upload-batches/{id}/publish` | Validates a cleaned batch, creates/resets the analysis job, marks it published, and starts analysis. |
| `GET /api/upload-batches/{id}/run-status` | Returns publishing, analysis, and optional RAG state. |
| `GET /api/upload-batches/{id}/analytics` | Returns the immutable analysis snapshot when ready; returns a processing state otherwise. |
| `GET /api/upload-batches` | Returns the authenticated user's latest runs for the dataset selector, without preview rows. |
| `POST /api/upload-batches/{id}/analysis/retry` | Creates a new attempt for a failed analysis without creating a new dataset version. |

`POST /api/upload-batches/{id}/ai-review` remains an intake briefing only. The new analytics endpoint becomes the source of truth for downstream Insights and Decisions.

## Frontend Experience

Add one application-level `activeDatasetRun` state, persisted with the existing upload session. It includes the source type, batch ID, version, state, and enough metadata to render the selector before analytics load. Reflect it in the URL as `?datasetRun=<batchId>` for all insight and decision routes, with the session state as a fallback only. This makes a saved link, browser refresh, and audit view resolve to the same run.

### Intake

- Keep the current six-stage lifecycle and MIA upload summary.
- Replace the ambiguous `Save cleaned data` completion point with `Publish to Insights` once quality is acceptable.
- After publication, show a compact run status and a `View insights` command that navigates to the first relevant insight page with the selected run active.
- If analysis is still processing, continue polling `run-status` and show the latest completed stage; do not navigate to an empty dashboard.

### Insights and Decisions

- Add a top-bar dataset selector to all Data Insights and Business Decisions pages. It offers `Public benchmark` plus the user's published IT and survey runs.
- The selected run is the only source for upload-derived cards, charts, insights, and recommendations. It must be visually identified with dataset name, version, record count, and generated time.
- Existing public-data components remain available when `Public benchmark` is selected.
- A comparison view may compare a run only with the public benchmark or a prior run that has the same source type and compatible schema fingerprint. It must label the two periods and analysis versions explicitly.
- Pages whose dimensions are unavailable for a run must state that the uploaded schema does not support that view, rather than displaying seeded public figures.
- The first delivered upload-aware views are Overview and Recommendations. Customer Voice, Passenger Profile, App Reviews, and Competitors receive a neutral unavailable state unless the data schema supports their required dimensions.
- Each recommendation exposes its evidence, quality context, and dataset run version.

## Failure and Governance

- A batch with no cleaned rows, unresolved fatal validation errors, or failed persistence cannot publish.
- A published run remains readable if analysis fails; the UI shows the run and error state with a retry command.
- A newer upload never changes an older run's analytics.
- Ownership checks apply to every run endpoint.
- RAG indexing failures are non-blocking and visible only as supplementary status.
- Raw uploads, cleaned files, analytics snapshots, and RAG chunks follow a shared retention policy. Deleting a run must revoke its selector entry, snapshot, optional RAG chunks, and derived cache while retaining only the minimum permitted audit metadata.
- The event envelope and analysis snapshot are versioned contracts. Any incompatible metric or mapping change creates a new `analysisVersion`, preserving the ability to explain historical decisions.

## Verification

- Unit tests for publish eligibility, state transitions, aggregate metric generation, and owner isolation.
- API tests for publish, status, analytics, and run listing.
- UI tests for publish-to-insights navigation, processing state, public benchmark fallback, and unavailable-schema state.
- Contract tests for the semantic mapping registry, event envelope, idempotent publish, retry behaviour, and URL-selected run.
- Privacy tests proving restricted fields do not enter analytics snapshots, event payloads, or optional RAG documents without explicit approval.
- A manual smoke test uploads one IT workbook and one survey, publishes each, verifies that Overview and Recommendations change to the correct dataset run, then switches back to the public benchmark.

## Delivery Sequence

1. Add manifest state and server-side aggregate analysis plus API tests.
2. Add the app-level dataset selector and status polling.
3. Wire publish actions in both intake routes.
4. Make Overview and Recommendations render the analytics snapshot.
5. Add empty-state contracts for the remaining insight pages and verify the complete flow.

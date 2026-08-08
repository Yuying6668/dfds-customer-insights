# DFDS Internal Review Console Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this spec task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an internal review console that lets the team inspect validation/reflection agent results, see the evidence chain behind each judgment, and decide whether a result is ready to surface in the public DFDS dashboard.

**Architecture:** Keep the existing DFDS dashboard and Update Log intact. Add a separate internal review page that reads structured review records from the backend, shows queue + detail + evidence chain in one place, and exposes a small publish/visibility state that can flow back into the dashboard as badges. The console should treat review output as first-class data, not loose notes.

**Tech Stack:** Static HTML/JS dashboard, existing frontend module pattern, PostgreSQL, existing evidence and keyword tables, existing chat/reporting backend.

---

## Product Decision

Build the internal review console as a **new dashboard page** rather than embedding the full review workflow inside existing business pages.

Reason:
- The review workflow is operational and detail-heavy.
- The dashboard already has a tight business narrative.
- A separate page keeps review metadata from crowding the public-facing story.

The public dashboard will only receive lightweight status badges and deep links into the review console.

## What This Console Is For

The console is for internal team members who need to answer:
- Did the validation or reflection agent behave correctly?
- Which evidence supported the output?
- Which layer failed: ingestion, retrieval, reasoning, or writeback?
- Is this result safe to expose in the main dashboard?
- What should be fixed before the next run?

It is not meant to replace the public dashboard. It is the control room behind it.

## Log Coverage Audit

This design is based on the project logs from:
- `dfds-customer-insights-logs/2026-07-16.md`
- `dfds-customer-insights-logs/2026-07-17.md`
- `dfds-customer-insights-logs/2026-07-18.md`
- `dfds-customer-insights-logs/2026-07-20.md`
- `dfds-customer-insights-logs/2026-07-21.md`

Those logs show that the review console must supervise more than final AI answers. It must cover:
- dashboard scope and route-filter behavior from July 16
- source limitations, Firecrawl search-result evidence, Google location-level evidence, and competitor snapshot quality from July 17
- local RAG fallback, bilingual answer behavior, and cache-busting from July 18
- PostgreSQL + pgvector, DeepSeek proxy, Memory RAG, RAG validation workbook, and frontend module split from July 20
- Mia small-talk/weather guard, multilingual evidence summaries, message-level route detection, and Quick read copy changes from July 21

The console should therefore act as a multi-layer harness for the whole DFDS evidence pipeline, not only as a review page for generated recommendations.

## Required Review Layers

The console must support these layers because they appear repeatedly in the logs:

### Scope and UI Behavior

Reviews whether the dashboard still respects core product boundaries:
- passenger ferry only
- English visible UI for the business dashboard
- route filter only appears on pages where route focus changes content
- Customer Voice and Recommendations honor selected route
- App Reviews, Competitors, Survey CSV, Update Log, and Data Basis do not imply route-specific behavior when none exists

### Source and Collection Quality

Reviews whether public evidence is collected and described honestly:
- Trustpilot scores and review counts
- Google Play and Apple App Store ratings and review text
- Google Reviews as location-level signals, not one DFDS brand score
- Reddit as discussion signals, not formal reviews
- Firecrawl search-result snapshots as directional evidence, not full scrape output
- blocked or verification-screen sources such as Trustpilot and Reddit
- Firecrawl credit usage and whether collection was explicitly approved

### Data Preparation and Database Integrity

Reviews whether data was cleaned and stored correctly:
- source, company, route, rating, review count, published date, URL, and metadata are populated where available
- evidence rows are deduplicated
- route labels stay canonical: all, Dover-Calais, Newhaven-Dieppe, Newcastle-IJmuiden, Jersey
- keywords and `evidence_keywords` links are synced
- raw review imports keep provenance in `raw_reviews`
- `sources` clearly identify source type and collection status

### Retrieval and RAG Behavior

Reviews whether the assistant retrieved relevant context:
- page context
- route focus
- evidence_items
- insight_items
- project_memories
- recent chat history
- frontend fallback evidence when database retrieval returns empty

It should flag answers that cite irrelevant evidence, miss obvious evidence, or use all-route evidence when a route-specific answer is required.

### Chat and Language Guardrails

Reviews whether Mia follows the conversational rules added on July 20 and July 21:
- weather and off-topic questions do not trigger evidence retrieval
- small talk returns bridge replies without evidence cards
- route mentions inside the message override stale route context
- Chinese, Danish, German, French, Spanish, Japanese, and Korean evidence summaries do not show long English evidence bodies
- DeepSeek missing-key fallback is explicit and does not pretend to be a live model answer

### Validation Assets

Reviews whether generated workbooks remain usable:
- 100-row platform Q&A workbook
- 50-row RAG validation workbook
- RAG validation status formula: Pending review / Pass / Review / Fail
- evidence anchors and route focus fields are present
- manual score and human notes columns remain editable

### Frontend Release Hygiene

Reviews whether browser-visible changes are actually reachable:
- `app/index.html` cache-busting version is updated after module changes
- `app/app.js` imports versioned `data.js` and versioned `chat-assistant.mjs`
- frontend module split remains intact
- Update Log receives an entry before the daily log is updated
- Quick read copy stays business-friendly and does not drift back into technical wording

## Information Architecture

### 1. Review Queue

Top-level queue of review items, sorted newest first and filterable by:
- layer: scope, collection, preparation, database, retrieval, reasoning, language, validation, release, publish
- status: pending, approved, needs changes, rejected
- severity: low, medium, high
- source: dashboard generation, evidence import, raw review import, keyword sync, RAG retrieval, chat answer, workbook generation, copy update, release hygiene, recommendation writeback
- route focus: all, Dover-Calais, Newhaven-Dieppe, Newcastle-IJmuiden, Jersey

Each queue row should show:
- title
- layer
- status badge
- severity badge
- timestamp
- short reason
- evidence count

### 2. Review Detail

Selecting a queue item opens a detail drawer or detail panel with:
- original agent output
- supervisor verdict
- short rationale
- evidence chain
- linked evidence IDs
- linked keyword IDs
- linked raw review IDs
- linked workbook row IDs when applicable
- suggested fix
- downstream impact
- publish recommendation

The detail view should preserve the raw output, not only the cleaned summary. Internal users need to inspect the messy edge cases.

### 3. Evidence Chain

Every review item should show a compact chain of:
- input context
- source collection status
- normalized data row
- model or agent output
- supervisor judgment
- linked evidence rows
- linked keyword rows
- final visibility decision

This chain is what stops the system from turning into a black box.

### 4. Dashboard Status Badges

The public dashboard should show only a small badge where needed:
- Verified
- Needs review
- Rejected
- Published

These badges should link into the internal review console, but not expose the full supervision workflow on the main pages.

For the first internal version, badges can be rendered from seeded review records and do not need to block the existing static dashboard. The stricter rule only applies to new agent-generated artifacts, new evidence imports, and recommendation writebacks created after the review layer exists.

## Data Model

Create a normalized review data layer in PostgreSQL:

### review_runs
One row per agent run or review batch.
- `id`
- `run_key`
- `run_type`
- `trigger_source`
- `status`
- `started_at`
- `finished_at`
- `input_snapshot`
- `output_snapshot`
- `summary`

### review_items
One row per reviewed artifact.
- `id`
- `run_id`
- `subject_type`
- `subject_id`
- `subject_label`
- `layer`
- `status`
- `severity`
- `title`
- `reason`
- `recommendation`
- `publish_state`
- `route_key`
- `source_key`
- `language`
- `created_at`
- `updated_at`

### review_item_evidence
Join table for the evidence chain.
- `review_item_id`
- `evidence_id`
- `relation_type`
- `position`
- `weight`

### review_item_keywords
Join table for keyword-level review context.
- `review_item_id`
- `keyword_id`
- `relation_type`
- `position`
- `weight`

### review_item_raw_reviews
Join table for raw public review provenance.
- `review_item_id`
- `raw_review_id`
- `relation_type`
- `position`

### review_item_artifacts
References generated files and validation workbooks.
- `review_item_id`
- `artifact_type`
- `artifact_path`
- `artifact_label`
- `metadata`

### review_item_actions
Audit trail for human or agent decisions.
- `review_item_id`
- `actor_type`
- `actor_name`
- `action_type`
- `notes`
- `created_at`

Reuse existing `evidence_items`, `keywords`, `evidence_keywords`, and `raw_reviews` rather than copying evidence into review tables.

## Backend Flow

1. A validation or reflection agent runs after ingestion, generation, or publishing.
2. The backend writes the result into `review_runs` and `review_items`.
3. Evidence links are stored in `review_item_evidence`.
4. A human reviewer can update the item status and leave an action note.
5. The frontend reads the structured review data and renders the console.
6. If the item is approved, the dashboard badge updates to `Published` or `Verified`.

The key rule is that new agent-generated results and new writebacks only become eligible for public dashboard surfacing after they have a stored review state. Existing static dashboard content should keep working while the internal console is introduced.

## Initial Seed Items

The first implementation should seed representative review records from the project logs so the console can be evaluated immediately:
- scope behavior from July 16: passenger ferry boundary and route-filter visibility
- source-quality behavior from July 17: Google location-level evidence, Reddit discussion signal labeling, and Firecrawl search-result limitations
- retrieval behavior from July 18 and July 20: frontend fallback evidence, database RAG context, project memories, and 50-row validation set coverage
- Mia guardrail behavior from July 20 and July 21: small talk/weather routing, message-level route detection, and multilingual evidence summaries
- release hygiene from July 18 through July 21: cache-busting updates and Update Log sequencing

These seeded items are internal supervision examples. They should be clearly marked as `seeded_from_log` or equivalent metadata so they are not confused with live validation runs.

## Frontend Layout

### Sidebar

Add a new nav item for the internal review console:
- `Review Console`

Keep `Update Log` as a separate page. Do not merge the two.

### Main View

The page should use a three-part layout:
- queue on the left or top
- detail panel in the main area
- evidence chain in a collapsible right rail or drawer

On smaller screens, the queue becomes a stacked list and the detail panel becomes a full-width sheet.

### Core Controls

The console should include:
- filter chips
- search by title or evidence text
- saved filters for source quality, RAG answer quality, Mia behavior, workbook validation, and release hygiene
- status badge selectors
- approve/reject/needs-changes actions
- link back to source evidence
- link back to generated workbook or log artifact
- copy reviewer note

## Styling Rules

- Keep the console utilitarian and dense.
- Use compact badges, not large cards.
- Do not use marketing-style hero treatment.
- Keep the review information scannable.
- Use fixed panel widths and stable layout tracks so long notes do not shift the UI.

## Error Handling

- If no review records exist, show an empty state that explains the console is waiting for the first validated run.
- If a review item has missing evidence links, show a warning state rather than hiding the row.
- If a review run fails, record the failure in the run record and render it as a review item with a failed status.
- If backend data is stale, surface the last updated time in the header.
- If a source was blocked by verification, label the item `Source blocked` and show the attempted URL and collection method.
- If a generated answer falls back because `DEEPSEEK_API_KEY` is missing, label it `Backend fallback` rather than `Verified`.
- If a cache-busting version was not updated after frontend changes, mark the release item `Needs changes`.

## Acceptance Criteria

- The dashboard has a separate internal review page.
- Review items are filterable by layer, status, severity, source, and route.
- Each item shows an evidence chain and a verdict.
- The public dashboard can show a simple review badge.
- Update Log remains a separate changelog page.
- A reviewer can tell what failed without opening code.
- The console can represent source-quality issues from Firecrawl, Trustpilot verification screens, Reddit blocking, and location-level Google Reviews.
- The console can represent Mia behavior issues such as weather/off-topic retrieval, language mismatch, and route mismatch.
- The console can link a review item to evidence, keywords, raw reviews, generated workbook rows, and daily log artifacts.
- The console can distinguish production evidence from synthetic or validation-only evidence.

## Testing

- Unit test the review record renderers with representative states.
- Unit test the status badge mapping.
- Unit test the queue filtering logic.
- Verify the console opens from navigation and preserves page state.
- Verify the page renders correctly at desktop and mobile widths.
- Verify a missing-evidence item shows a warning state.
- Test a source-blocked item from Trustpilot or Reddit.
- Test a Firecrawl search-result item that must be labeled directional.
- Test a route mismatch item for Dover-Calais.
- Test a Mia weather question that must not show evidence cards.
- Test a multilingual evidence item that must not show long English evidence body for non-English input.
- Test a cache-busting release hygiene item.

## Scope Boundary

This is an internal operational tool. It does not need:
- user login
- role management
- notifications
- a workflow engine
- public sharing

Those can come later once the review loop is stable.

# Survey CSV Data Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Replace the Survey CSV placeholder with an upload-to-MIA questionnaire standardisation workspace that follows the IT Data Flow model.

**Architecture:** Keep uploaded files in the existing immutable upload-batch pipeline. Build \`SurveyCsvRoute\` around existing authenticated upload, MIA review, export, and row-preview APIs, but use survey-specific copy, accepted types, lifecycle labels, mapping tabs, and derived counts. A small helper keeps survey terms out of IT Data Flow.

**Tech Stack:** React 19, Vite, existing Python upload-batch service, Node built-in test runner, CSS.

---

## File Structure

| File | Responsibility |
| --- | --- |
| \`app/routes/survey-csv-state.mjs\` | Survey extensions, six lifecycle labels, and preview-count helpers. |
| \`app/routes/SurveyCsvRoute.jsx\` | Upload workflow, MIA summary, mapping/exceptions tabs, export controls, and preview table. |
| \`app/styles.css\` | Survey-specific tab, mapping, and narrow-screen styles. |
| \`app/App.jsx\` | Pass active uploaded batch ID through Survey CSV to MIA and update page brief. |
| \`tests/survey-csv-state.test.mjs\` | Unit coverage for types, lifecycle, and counts. |
| \`tests/survey-csv-route.test.mjs\` | Route regions and style-hook regression coverage. |
| \`app/data/update-log.mjs\` | Release record, updated before daily log. |
| \`dfds-customer-insights-logs/2026-07-30.md\` | Implementation and verification record. |

### Task 1: Define Survey CSV Intake State

**Files:**
- Create: \`app/routes/survey-csv-state.mjs\`
- Test: \`tests/survey-csv-state.test.mjs\`

- [ ] **Step 1: Write the failing helper tests**

\`\`\`js
import assert from "node:assert/strict";
import test from "node:test";
import { getSurveyLifecycleStages, isAcceptedSurveyFile, surveyPreviewCounts } from "../app/routes/survey-csv-state.mjs";

test("accepts questionnaire CSV and Excel files only", () => {
  assert.equal(isAcceptedSurveyFile({ name: "responses.csv" }), true);
  assert.equal(isAcceptedSurveyFile({ name: "responses.xlsx" }), true);
  assert.equal(isAcceptedSurveyFile({ name: "notes.pdf" }), false);
});
test("maps the uploaded batch to six survey standardisation stages", () => {
  assert.deepEqual(getSurveyLifecycleStages([]).map(({ label }) => label), ["Capture", "Profile", "Clean", "Standardise", "Validate", "Publish"]);
});
test("counts standardised rows, fields, and exceptions", () => {
  const batch = { files: [{ sheets: [{ columns: ["rating", "route"], cleaning: { cleanedRows: 8, mappingExceptions: 2 } }] }] };
  assert.deepEqual(surveyPreviewCounts(batch), { standardisedRows: 8, mappedFields: 2, exceptions: 2 });
});
\`\`\`

- [ ] **Step 2: Run the test and confirm it fails**

Run: \`node --test tests/survey-csv-state.test.mjs\`

Expected: FAIL because \`survey-csv-state.mjs\` does not exist.

- [ ] **Step 3: Implement the bounded survey helper**

\`\`\`js
export const SURVEY_EXTENSIONS = new Set(["csv", "xlsx", "xls"]);
export function isAcceptedSurveyFile(file) {
  return SURVEY_EXTENSIONS.has(String(file?.name || "").split(".").pop().toLowerCase());
}
export function getSurveyLifecycleStages(lifecycle = []) {
  const states = new Map(lifecycle.map((stage) => [stage.key, stage.state]));
  return [["capture", "Capture", "Store source and consent metadata."], ["profile", "Profile", "Read sheets, headers and response count."], ["clean", "Clean", "Remove blank and duplicate responses."], ["standardise", "Standardise", "Map questions, ratings and values."], ["validate", "Validate", "Flag missing fields and mapping exceptions."], ["publish", "Publish", "Release approved evidence to MIA."]].map(([key, label, detail], index) => ({ key, label, detail, state: states.get(key) || (index < 2 ? "complete" : index === 2 ? "active" : "pending") }));
}
export function surveyPreviewCounts(batch) {
  return (batch?.files || []).flatMap((file) => file.sheets || []).reduce((total, sheet) => ({ standardisedRows: total.standardisedRows + Number(sheet.cleaning?.cleanedRows || 0), mappedFields: total.mappedFields + (sheet.columns || []).length, exceptions: total.exceptions + Number(sheet.cleaning?.mappingExceptions || 0) }), { standardisedRows: 0, mappedFields: 0, exceptions: 0 });
}
\`\`\`

- [ ] **Step 4: Run the helper test and confirm it passes**

Run: \`node --test tests/survey-csv-state.test.mjs\`

Expected: PASS with three passing subtests.

- [ ] **Step 5: Commit the helper task**

\`\`\`bash
git add app/routes/survey-csv-state.mjs tests/survey-csv-state.test.mjs
git commit -m "feat: add survey csv intake state"
\`\`\`

### Task 2: Replace The Placeholder With The Survey Intake Workflow

**Files:**
- Modify: \`app/routes/SurveyCsvRoute.jsx\`
- Modify: \`app/App.jsx\`
- Test: \`tests/survey-csv-route.test.mjs\`

- [ ] **Step 1: Write the failing route contract test**

\`\`\`js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const source = await readFile(new URL("../app/routes/SurveyCsvRoute.jsx", import.meta.url), "utf8");
test("Survey CSV contains the approved workflow regions", () => {
  for (const expected of ["Upload a survey CSV", "MIA summary", "Questionnaire standardisation preview", "Standardised responses", "Question mapping", "Exceptions"]) assert.match(source, new RegExp(expected));
  assert.match(source, /onUploadedBatchChange/);
});
\`\`\`

- [ ] **Step 2: Run the route test and confirm it fails**

Run: \`node --test tests/survey-csv-route.test.mjs\`

Expected: FAIL because the placeholder lacks the workflow and active-batch callback.

- [ ] **Step 3: Implement the stateful survey route**

Replace the placeholder with a component using \`DataTable\`, \`getAccessToken\`, \`uploadBatch\`, \`reviewUploadedBatch\`, and Task 1 helpers. Reject files before upload unless \`isAcceptedSurveyFile(file)\` returns true. On success retain the batch, call \`onUploadedBatchChange(batch.batch.id)\`, select the first profiled sheet, and request \`reviewUploadedBatch(batch.batch.id)\`.

Render these regions in order:

\`\`\`jsx
<header className="it-workspace-heading"><p className="eyebrow">Data intake</p><h3>Survey CSV</h3><p>Bring internal questionnaire responses into the governed customer-evidence workflow.</p></header>
<section className="batch-intake-surface" aria-label="Upload survey CSV">...</section>
<ol className="batch-lifecycle" aria-label="Survey standardisation lifecycle">...</ol>
<section className="ai-review-result" aria-labelledby="surveyMiaReviewTitle">...</section>
<section className="workbook-preview-panel survey-standardisation-preview" aria-labelledby="surveyPreviewTitle">...</section>
\`\`\`

The preview uses a three-button \`tablist\`: \`standardised\` renders masked \`DataTable\` rows; \`mapping\` renders source field, standard field, and mapping state; \`exceptions\` renders exception rows or a no-exceptions state. Reuse authenticated \`/sheets\`, \`/save-cleaned\`, and \`/export\` calls plus current pagination.

In \`app/App.jsx\`, pass \`onUploadedBatchChange={setUploadedBatchId}\` to \`RouteComponent\`, and change the Survey CSV page brief to \`Survey questionnaire upload, standardisation checks, and MIA-ready evidence preview.\`

- [ ] **Step 4: Run route regression tests**

Run: \`node --test tests/survey-csv-route.test.mjs tests/router.test.mjs tests/branding.test.mjs\`

Expected: PASS.

- [ ] **Step 5: Commit the workflow task**

\`\`\`bash
git add app/routes/SurveyCsvRoute.jsx app/App.jsx tests/survey-csv-route.test.mjs
git commit -m "feat: add survey csv data flow workspace"
\`\`\`

### Task 3: Apply The Approved Operational Layout

**Files:**
- Modify: \`app/styles.css\`
- Test: \`tests/survey-csv-route.test.mjs\`

- [ ] **Step 1: Add failing style assertions**

\`\`\`js
const css = await readFile(new URL("../app/styles.css", import.meta.url), "utf8");
test("Survey CSV retains a responsive operational preview", () => {
  assert.match(css, /\.survey-standardisation-preview/);
  assert.match(css, /\.survey-preview-tabs/);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
});
\`\`\`

- [ ] **Step 2: Run the expanded test and confirm it fails**

Run: \`node --test tests/survey-csv-route.test.mjs\`

Expected: FAIL because survey-specific style rules do not exist.

- [ ] **Step 3: Add scoped CSS while reusing shared workflow chrome**

\`\`\`css
.survey-standardisation-preview { gap: 14px; }
.survey-preview-tabs { display: flex; gap: 8px; overflow-x: auto; }
.survey-preview-tabs button { flex: 0 0 auto; min-height: 36px; }
.survey-mapping-list { display: grid; border: 1px solid var(--line); }
.survey-mapping-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 12px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
@media (max-width: 720px) { .survey-mapping-row { grid-template-columns: 1fr; gap: 4px; } }
\`\`\`

Use existing \`batch-intake-surface\`, \`batch-lifecycle\`, \`ai-review-result\`, and \`workbook-preview-panel\` rules for shared surfaces. Do not add nested panels or metric-card grids.

- [ ] **Step 4: Run all frontend tests and build**

Run: \`node --test tests/*.test.mjs && pnpm build\`

Expected: all tests PASS and Vite outputs \`dist/\` without errors.

- [ ] **Step 5: Commit styling and coverage**

\`\`\`bash
git add app/styles.css tests/survey-csv-route.test.mjs
git commit -m "style: align survey csv with data flow workspace"
\`\`\`

### Task 4: Record And Verify The Release

**Files:**
- Modify: \`app/data/update-log.mjs\`
- Create: \`dfds-customer-insights-logs/2026-07-30.md\`

- [ ] **Step 1: Add the update-log record before the daily log**

\`\`\`js
{ time: "2026-07-30 00:00", module: "Survey CSV Data Flow", change: "Replaced the Survey CSV placeholder with an upload-to-MIA questionnaire standardisation workspace", reason: "Survey evidence needs the same visible intake, cleaning, validation, and governed-review path as IT Data Flow.", scope: "Survey upload, six-stage lifecycle, MIA summary, standardisation preview, mapping exceptions, exports, responsive styling, and regression tests", result: "Questionnaire exports now move through a visible and auditable survey-specific workflow before approved evidence is available to Mia.", status: "Completed" }
\`\`\`

- [ ] **Step 2: Add the daily implementation log**

\`\`\`md
# 2026-07-30

## Survey CSV Data Flow

- Replaced the Survey CSV placeholder with a batch-first questionnaire intake workspace.
- Reused authenticated upload-batch profiling, cleaning, MIA review, masked preview, save, and export behavior.
- Added Capture, Profile, Clean, Standardise, Validate, and Publish labels plus mapping and exception review tabs.
- Verified unit tests, production build, upload interaction, and responsive preview behavior.
\`\`\`

- [ ] **Step 3: Run final automated checks**

Run: \`node --test tests/*.test.mjs && pnpm build\`

Expected: PASS and a fresh production bundle in \`app/dist/\`.

- [ ] **Step 4: Run the app and verify the complete browser workflow**

Run: \`PORT=8767 .venv/bin/python -u server.py\`

Verify at \`http://127.0.0.1:8767/survey-csv\`: a PDF shows an inline error without a request; a CSV shows progress then all six survey stages, MIA summary, and preview; mapping and exception tabs preserve the batch; save/export controls stay available; at 390px lifecycle items wrap, MIA panels stack, and the table scrolls horizontally.

- [ ] **Step 5: Commit release records**

\`\`\`bash
git add app/data/update-log.mjs dfds-customer-insights-logs/2026-07-30.md
git commit -m "docs: record survey csv data flow release"
\`\`\`


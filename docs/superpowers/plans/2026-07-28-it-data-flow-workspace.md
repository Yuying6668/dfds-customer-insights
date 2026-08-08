# IT Data Flow Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the card-heavy IT Data Flow page with a batch-first technical review workspace that traces a source batch from upload to governed Dashboard and Mia consumption.

**Architecture:** Extract pure batch-state helpers so the empty and selected-batch states can be tested with Node's built-in test runner. Recompose the existing React route around a dominant upload surface, a compact lifecycle strip, a closed-by-default Mia intake brief, and expandable lineage, data contract, quality review, and platform architecture sections.

**Tech Stack:** React 19, Vite 7, existing CSS tokens, Node built-in test runner, Python static server, Browser/IAB.

---

## File Structure

- Create: `app/routes/it-data-flow-state.mjs` - pure file metadata, batch summary, and lifecycle helpers.
- Create: `work/test_it_data_flow_state.mjs` - Node assertions for batch state and required page structure.
- Modify: `app/routes/ITDataFlowRoute.jsx` - batch-first UI composition and disclosure interactions.
- Modify: `app/styles.css` - workspace layout, lifecycle strip, Mia brief, and responsive rules.
- Modify: `app/data/update-log.mjs` - user-facing product change entry.
- Modify: `dfds-customer-insights-logs/2026-07-28.md` - daily implementation and validation record.
- Modify: `app/dist/*` - Vite production output.

### Task 1: Test and Implement Batch State Helpers

**Files:**
- Create: `app/routes/it-data-flow-state.mjs`
- Create: `work/test_it_data_flow_state.mjs`

- [ ] Write a failing Node test for an empty batch, two selected files, file-size formatting, file-type labels, and lifecycle state.
- [ ] Run `node work/test_it_data_flow_state.mjs` and confirm it fails because the helper module is missing.
- [ ] Implement `formatBytes`, `getFileTypeLabel`, `buildBatchSummary`, and `getLifecycleStages` in `app/routes/it-data-flow-state.mjs`.
- [ ] Re-run `node work/test_it_data_flow_state.mjs` and confirm the test passes.

### Task 2: Compose the Batch-First React Route

**Files:**
- Modify: `app/routes/ITDataFlowRoute.jsx`
- Modify: `work/test_it_data_flow_state.mjs`

- [ ] Extend the test with source assertions for `Mia intake brief`, `Batch lineage`, `Data contract`, `Quality review`, and `Platform architecture`, and assertions that legacy `Flow map` and `Processing monitor` titles are absent.
- [ ] Run the test and confirm the existing route fails structural assertions.
- [ ] Replace the page summary, metric grid, flow map, old monitor, permanent right rail, and always-open AI summary with:
  - concise route heading;
  - dominant upload surface and selected-file summary;
  - six-stage lifecycle strip: Upload, Validate, Classify, Map, Review, Ready for Mia;
  - closed Mia intake brief;
  - four independently expandable technical disclosures.
- [ ] Keep file input, preview, visible-field table, and manual feedback behavior.
- [ ] Re-run the Node test and confirm it passes.

### Task 3: Style and Test the Workspace

**Files:**
- Modify: `app/styles.css`
- Modify: `work/test_it_data_flow_state.mjs`

- [ ] Add failing CSS assertions for `.batch-intake-layout`, `.batch-lifecycle`, `.mia-brief-trigger`, and mobile behavior.
- [ ] Add route-scoped CSS that makes upload visually dominant, renders a thin lifecycle strip, keeps the Mia brief bounded, and avoids a card grid.
- [ ] Add disclosure, table, review, and responsive styles using existing color tokens and 8px panel radii.
- [ ] Re-run the Node test and confirm it passes.

### Task 4: Record and Build

**Files:**
- Modify: `app/data/update-log.mjs`
- Modify: `dfds-customer-insights-logs/2026-07-28.md`
- Modify: `app/dist/*`

- [ ] Add an Update Log entry explaining the batch-first workspace redesign.
- [ ] Add a daily-log section with design rationale, modified files, test command, build command, and browser QA outcome.
- [ ] Build with the project-local Vite command and verify fresh assets are emitted under `app/dist`.
- [ ] Run the Node test again after building.

### Task 5: Browser QA

**Files:**
- Verify: `app/routes/ITDataFlowRoute.jsx`
- Verify: `app/styles.css`
- Verify: `app/dist/*`

- [ ] Open `http://localhost:8767/it-data-flow` in Browser/IAB and confirm the first viewport has upload, lifecycle, and a closed Mia brief only.
- [ ] Upload harmless local test files and confirm file details, total size, release state, and lifecycle update.
- [ ] Open and close the Mia brief, then each disclosure; submit a manual feedback note and confirm it appears under Quality review.
- [ ] Inspect desktop and mobile layout, browser console health, and screenshots.

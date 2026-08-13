# Data Intake Insight Version Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the uploaded dataset version and refresh timestamp on every Data Insights table driven by a published Data Intake batch.

**Architecture:** Keep the existing batch version as the single source of truth. Return that version and publication timestamp from the analytics endpoint even while analysis is processing, normalize the snapshot metadata in a small frontend helper, and render a compact status line in the shared uploaded-insight panel. Ready snapshots use `generatedAt`; processing snapshots use `publishedAt` and an updating status.

**Tech Stack:** React 19, Vite, ES modules, Python stdlib HTTP server, Node test runner.

---

### Task 1: Define the version display contract with tests

**Files:**
- Create: `app/lib/dataset-version.mjs`
- Create: `tests/dataset-version.test.mjs`

- [x] **Step 1: Write the failing tests** for preserving the batch version, choosing generated time when ready, choosing published time while processing, and returning a stable fallback label when metadata is absent.
- [x] **Step 2: Run the focused test** with `pnpm test -- tests/dataset-version.test.mjs` and confirm it fails because the helper does not exist.
- [x] **Step 3: Implement the minimal helper** with explicit `version`, `timestamp`, `status`, and `label` output.
- [x] **Step 4: Run the focused test** again and confirm it passes.

### Task 2: Make the analytics API expose version metadata during processing

**Files:**
- Modify: `server.py:3412-3428`
- Test: `tests/test_dataset_run_review.py`

- [x] **Step 1: Add a regression assertion** that the processing response includes the batch version and published timestamp.
- [x] **Step 2: Run the focused Python test** with `.venv/bin/python -m unittest tests.test_dataset_run_review -v` and observe the expected failure.
- [x] **Step 3: Return `version` and `publishedAt`** in the analytics 202 response without exposing raw rows.
- [x] **Step 4: Run the focused Python test** again and confirm it passes.

### Task 3: Render version state on uploaded insight tables

**Files:**
- Modify: `app/components/UploadedInsightPanel.jsx`
- Test: `tests/dataset-version.test.mjs`

- [x] **Step 1: Use the tested helper** in the shared panel.
- [x] **Step 2: Render `Updated · <version>` and `Updated at <timestamp>` for ready snapshots; render `Updating · <version>` for processing snapshots.
- [x] **Step 3: Run the full frontend test suite and production build.**

### Task 4: Verify and hand off

**Files:**
- No additional files.

- [x] **Step 1: Run `pnpm test`, `pnpm build`, and `git diff --check`.
- [x] **Step 2: Confirm the existing unrelated worktree changes remain unstaged and untouched.
- [x] **Step 3: Report the version display behavior and validation results.

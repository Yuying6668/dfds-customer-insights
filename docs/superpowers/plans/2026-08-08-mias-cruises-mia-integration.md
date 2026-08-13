# Mia's Cruises/MIA Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the Mia's Cruises/MIA customer-insights application and its survey/RAG implementation into one readable, reproducible Git repository.

**Architecture:** Keep the existing full-stack application as the canonical runtime. Move the independent survey/RAG pipeline under `backend/survey_pipeline/`, its reusable scripts under `scripts/`, and its tests under `tests/survey_pipeline/`. Preserve MIA-specific design material in `docs/` and keep generated exports and local credentials out of version control.

**Tech Stack:** Python 3.12+, standard-library HTTP server, React 19, Vite, Node test runner, pytest/unittest, JSON/CSV/XLSX data exports.

---

### Task 1: Establish repository hygiene

**Files:**
- Create: `.gitignore` additions
- Create: `README.md`

- [ ] Add ignores for caches, virtual environments, generated previews/exports, and local secrets while retaining `.env.example`.
- [ ] Document the canonical project layout, local setup, test commands, and the `Mia` branch workflow.
- [ ] Verify no `.env` or virtual-environment files are tracked by the initial commit.

### Task 2: Integrate the survey/RAG pipeline

**Files:**
- Create: `backend/survey_pipeline/{survey_schema.py,generate_survey.py,curate_survey.py,build_rag.py}`
- Create: `scripts/{build_survey_outputs.py,export_survey_workbooks.mjs}`
- Create: `tests/survey_pipeline/{test_generate_survey.py,test_curation.py,test_search_logic.py,test_exports.py}`

- [ ] Copy the reusable pipeline modules and tests from the dated survey project into stable repository paths.
- [ ] Update imports and test roots so they run from the canonical repository.
- [ ] Keep generated JSON/CSV/XLSX outputs as documented artifacts, not source code.

### Task 3: Consolidate MIA frontend references

**Files:**
- Create: `app/mia/{README.md,branding.css,operating-model.md}`

- [ ] Extract the stable MIA branding and operating-model guidance from the dated implementation directories into a small, discoverable module.
- [ ] Keep the existing application entrypoint unchanged unless a test demonstrates an integration regression.

### Task 4: Verify and create the delivery branch

- [ ] Run Python compilation and the existing Python test suite.
- [ ] Run the Node test suite and production Vite build.
- [ ] Inspect tracked-file candidates for secrets, caches, and oversized generated data.
- [ ] Initialize Git history if needed, create branch `Mia`, and commit the consolidated project.
- [ ] Add the user-provided GitHub remote and push `Mia` after the repository URL is available.

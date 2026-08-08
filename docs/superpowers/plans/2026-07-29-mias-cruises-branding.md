# Mia's Cruises Frontend Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public-facing DFDS identity with Mia's Cruises and remove the sidebar logo without changing runtime data contracts.

**Architecture:** Keep the existing React shell and data model intact. Change only display strings in the React UI and retain the existing `dfdsIntelligenceData` export and source data identifiers.

**Tech Stack:** React 19, Vite 7, Node built-in test runner.

---

### Task 1: Brand the application shell

**Files:**
- Create: `tests/branding.test.mjs`
- Modify: `app/App.jsx:89-103`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the application shell presents Mia's Cruises without the DFDS logo", async () => {
  const app = await readFile(new URL("../app/App.jsx", import.meta.url), "utf8");
  assert.match(app, /Mia's Cruises/);
  assert.doesNotMatch(app, /DFDS_logo_2015\.svg/);
  assert.doesNotMatch(app, /brand-logo-card/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/branding.test.mjs`

Expected: FAIL because the shell still contains the DFDS logo and no Mia's Cruises label.

- [ ] **Step 3: Implement the minimal shell change**

Replace the `.brand-logo-card` image block in `app/App.jsx` with no replacement element. Change the sidebar heading and topbar heading to use `Mia's Cruises`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/branding.test.mjs`

Expected: PASS with one passing test.

- [ ] **Step 5: Build the frontend**

Run: `npm run build`

Expected: Vite completes with exit code 0 and writes the production bundle to `app/dist`.

- [ ] **Step 6: Commit**

This workspace has no Git repository, so no commit is possible. Preserve the change in place and report the verification output.

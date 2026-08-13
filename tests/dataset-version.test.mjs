import test from "node:test";
import assert from "node:assert/strict";
import { getDatasetAnalysisState, getDatasetVersionMeta, isDatasetAnalysisProcessing } from "../app/lib/dataset-version.mjs";

test("treats only active analysis states as processing", () => {
  assert.equal(isDatasetAnalysisProcessing({ analysisState: "processing" }), true);
  assert.equal(isDatasetAnalysisProcessing({ analysisState: "not_started" }), true);
  assert.equal(isDatasetAnalysisProcessing({ analysisState: "ready" }), false);
  assert.equal(isDatasetAnalysisProcessing({ analysisState: "failed" }), false);
});

test("classifies ready and failed dataset analysis responses", () => {
  assert.equal(getDatasetAnalysisState({ analysisState: "ready" }), "ready");
  assert.equal(getDatasetAnalysisState({ analysisState: "processing" }), "processing");
  assert.equal(getDatasetAnalysisState({ analysisState: "failed" }), "failed");
  assert.equal(getDatasetAnalysisState({ error: true }), "failed");
});

test("does not label a failed analysis as updated", () => {
  assert.deepEqual(getDatasetVersionMeta({ analysisState: "failed", version: "v20260813-101500" }), {
    version: "v20260813-101500",
    timestamp: "",
    status: "failed",
    label: "Analysis failed · v20260813-101500"
  });
});

test("uses generated time and ready label for completed analysis", () => {
  assert.deepEqual(getDatasetVersionMeta({ version: "v20260813-101500", generatedAt: "2026-08-13T10:16:00Z" }), {
    version: "v20260813-101500",
    timestamp: "2026-08-13T10:16:00Z",
    status: "ready",
    label: "Updated · v20260813-101500"
  });
});

test("uses publication time and updating label while analysis is processing", () => {
  assert.deepEqual(getDatasetVersionMeta({ version: "v20260813-101500", publishedAt: "2026-08-13T10:15:00Z", analysisState: "processing" }), {
    version: "v20260813-101500",
    timestamp: "2026-08-13T10:15:00Z",
    status: "processing",
    label: "Updating · v20260813-101500"
  });
});

test("keeps a stable fallback when version metadata is missing", () => {
  assert.deepEqual(getDatasetVersionMeta({}), {
    version: "unknown",
    timestamp: "",
    status: "ready",
    label: "Updated · unknown"
  });
});

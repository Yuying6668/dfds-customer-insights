import test from "node:test";
import assert from "node:assert/strict";
import { datasetRunNavigationSnapshot, datasetSupportsInsight, getInsightNavigationState, mergeDatasetRunNavigationSnapshot } from "../app/lib/dataset-insight-routing.mjs";

test("routes rating and survey dimensions to Customer Voice", () => {
  assert.equal(datasetSupportsInsight("customer-voice", { schemaAvailability: { availableConcepts: ["rating", "route"] } }), true);
});

test("routes passenger dimensions to Passenger Profile", () => {
  assert.equal(datasetSupportsInsight("passenger-profile", { schemaAvailability: { availableConcepts: ["bookings"] } }), true);
});

test("routes market comparison dimensions to Competitors", () => {
  assert.equal(datasetSupportsInsight("competitors", { schemaAvailability: { availableConcepts: ["market"] } }), true);
});

test("leaves unsupported insight pages on their public baseline", () => {
  assert.equal(datasetSupportsInsight("app-reviews", { schemaAvailability: { availableConcepts: ["revenue"] } }), false);
});

test("does not treat route coverage as customer voice or competitor analysis", () => {
  const analytics = { schemaAvailability: { availableConcepts: ["route", "revenue"] } };
  assert.equal(datasetSupportsInsight("customer-voice", analytics), false);
  assert.equal(datasetSupportsInsight("competitors", analytics), false);
  assert.equal(datasetSupportsInsight("passenger-profile", analytics), true);
});

test("marks supported insight navigation items with the uploaded version", () => {
  assert.deepEqual(getInsightNavigationState("customer-voice", {
    activeDatasetRun: "batch-1",
    analytics: { analysisState: "ready", version: "v20260813-101500", generatedAt: "2026-08-13T10:16:00Z", schemaAvailability: { availableConcepts: ["rating"] } }
  }), { status: "updated", version: "v20260813-101500", label: "Updated · v20260813-101500" });
});

test("marks a supported insight navigation item as updating before analysis is ready", () => {
  assert.deepEqual(getInsightNavigationState("passenger-profile", {
    activeDatasetRun: "batch-1",
    analytics: { analysisState: "processing", version: "v20260813-101500", publishedAt: "2026-08-13T10:15:00Z", schemaAvailability: { availableConcepts: ["bookings"] } }
  }), { status: "updating", version: "v20260813-101500", label: "Updating · v20260813-101500" });
});

test("replaces a ready navigation snapshot with the processing event from a re-run", () => {
  const previous = {
    batchId: "batch-1",
    version: "v20260813-101500",
    analysisState: "ready",
    schemaAvailability: { availableConcepts: ["rating"] }
  };
  const next = mergeDatasetRunNavigationSnapshot(previous, {
    batchId: "batch-1",
    version: "v20260813-101500",
    datasetRun: { analysisState: "processing", publishedAt: "2026-08-13T10:20:00Z", lineage: { availableConcepts: ["rating"] } }
  });

  assert.deepEqual(getInsightNavigationState("customer-voice", { activeDatasetRun: "batch-1", analytics: next }), {
    status: "updating", version: "v20260813-101500", label: "Updating · v20260813-101500"
  });
});

test("does not mark an insight navigation item when the upload has no matching concepts", () => {
  assert.equal(getInsightNavigationState("app-reviews", {
    activeDatasetRun: "batch-1",
    analytics: { version: "v20260813-101500", schemaAvailability: { availableConcepts: ["revenue"] } }
  }), null);
});

test("marks competitors when an uploaded survey exposes rating data", () => {
  assert.deepEqual(getInsightNavigationState("competitors", {
    activeDatasetRun: "survey-batch",
    analytics: {
      analysisState: "ready",
      version: "v20260813-115957",
      schemaAvailability: { availableConcepts: ["country", "rating", "route"] }
    }
  }), {
    status: "updated",
    version: "v20260813-115957",
    label: "Updated · v20260813-115957"
  });
});

test("uses published dataset-run lineage before the analytics snapshot is ready", () => {
  const snapshot = datasetRunNavigationSnapshot({
    batchId: "batch-1",
    version: "v20260813-101500",
    datasetRun: { analysisState: "processing", publishedAt: "2026-08-13T10:15:00Z", lineage: { availableConcepts: ["bookings"] } }
  });
  assert.deepEqual(getInsightNavigationState("passenger-profile", { activeDatasetRun: "batch-1", analytics: snapshot }), {
    status: "updating", version: "v20260813-101500", label: "Updating · v20260813-101500"
  });
});

test("uses the published run summary to mark ready insight views", () => {
  const snapshot = datasetRunNavigationSnapshot({
    batchId: "batch-1",
    version: "v20260813-102842",
    datasetRun: { analysisState: "ready", lineage: { availableConcepts: ["revenue", "route"] } }
  });
  assert.deepEqual(getInsightNavigationState("passenger-profile", { activeDatasetRun: "batch-1", analytics: snapshot }), {
    status: "updated", version: "v20260813-102842", label: "Updated · v20260813-102842"
  });
  assert.equal(getInsightNavigationState("competitors", { activeDatasetRun: "batch-1", analytics: snapshot }), null);
});

test("does not mark an insight page for an unknown analysis state", () => {
  assert.equal(getInsightNavigationState("customer-voice", {
    activeDatasetRun: "batch-1",
    analytics: { version: "v20260813-101500", schemaAvailability: { availableConcepts: ["rating"] } }
  }), null);
});

test("does not mark an insight page after its analysis failed", () => {
  assert.equal(getInsightNavigationState("customer-voice", {
    activeDatasetRun: "batch-1",
    analytics: { analysisState: "failed", version: "v20260813-101500", schemaAvailability: { availableConcepts: ["rating"] } }
  }), null);
});

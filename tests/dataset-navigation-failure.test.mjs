import test from "node:test";
import assert from "node:assert/strict";
import { getInsightNavigationState } from "../app/lib/dataset-insight-routing.mjs";

test("does not mark an insight page as updated when its selected dataset run failed", () => {
  assert.equal(getInsightNavigationState("customer-voice", {
    activeDatasetRun: "batch-1",
    analytics: {
      analysisState: "failed",
      version: "v20260813-101500",
      schemaAvailability: { availableConcepts: ["rating"] }
    }
  }), null);
});

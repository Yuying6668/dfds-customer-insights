import assert from "node:assert/strict";
import test from "node:test";
import { buildUploadedInsightView } from "../app/lib/uploaded-insight-view.mjs";

test("builds a Customer Voice view from uploaded aggregate metrics and dimensions", () => {
  assert.deepEqual(buildUploadedInsightView({
    version: "v20260813-110000",
    generatedAt: "2026-08-13T11:00:00Z",
    datasetOverview: { recordCount: 40 },
    quality: { mappingExceptions: 2, invalidValues: 1 },
    metrics: { rating: { average: 3.75, sampleSize: 40 } },
    distributions: { route: { "Dover-Calais": 30, "Newhaven-Dieppe": 10 }, language: { EN: 24, DA: 16 } }
  }), {
    version: "v20260813-110000",
    generatedAt: "2026-08-13T11:00:00Z",
    recordCount: 40,
    quality: "2 mapping exceptions · 1 invalid values",
    dimensions: [
      { concept: "route", label: "Route distribution", values: [{ label: "Dover-Calais", count: 30, share: "75.0%" }, { label: "Newhaven-Dieppe", count: 10, share: "25.0%" }] },
      { concept: "language", label: "Language distribution", values: [{ label: "EN", count: 24, share: "60.0%" }, { label: "DA", count: 16, share: "40.0%" }] }
    ]
  });
});

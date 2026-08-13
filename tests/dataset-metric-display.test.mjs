import assert from "node:assert/strict";
import test from "node:test";
import { displayDatasetMetric } from "../app/lib/dataset-metric-display.mjs";

test("renders revenue totals separately when the uploaded dataset contains multiple currencies", () => {
  assert.equal(displayDatasetMetric({
    sampleSize: 2,
    currencies: { EUR: { sum: 113.15 }, DKK: { sum: 345868 } }
  }), "345,868 DKK · 113.15 EUR");
});

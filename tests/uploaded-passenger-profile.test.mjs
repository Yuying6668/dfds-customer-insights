import assert from "node:assert/strict";
import test from "node:test";
import { buildUploadedPassengerProfile } from "../app/lib/uploaded-passenger-profile.mjs";

test("builds the passenger profile from the uploaded snapshot instead of public sample data", () => {
  assert.deepEqual(buildUploadedPassengerProfile({
    version: "v20260813-102842",
    generatedAt: "2026-08-13T10:34:58Z",
    datasetOverview: { recordCount: 340 },
    metrics: { revenue: { sampleSize: 337, currencies: { EUR: { sum: 82401.21, sampleSize: 337 } } } },
    distributions: { route: { "Dover-Calais": 232, "Newhaven-Dieppe": 108 } },
    quality: { mappingExceptions: 12, invalidValues: 5 }
  }), {
    version: "v20260813-102842",
    recordCount: 340,
    revenue: ["82,401.21 EUR"],
    revenueSampleSize: 337,
    routes: [
      { label: "Dover-Calais", count: 232, share: "68.2%" },
      { label: "Newhaven-Dieppe", count: 108, share: "31.8%" }
    ],
    quality: "12 mapping exceptions · 5 invalid values",
    generatedAt: "2026-08-13T10:34:58Z"
  });
});

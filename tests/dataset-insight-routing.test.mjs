import test from "node:test";
import assert from "node:assert/strict";
import { datasetSupportsInsight } from "../app/lib/dataset-insight-routing.mjs";

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

import assert from "node:assert/strict";
import test from "node:test";
import { getPersistedITDataFlowReviewState } from "../app/routes/it-data-flow-state.mjs";

test("restores the completed MIA review from the IT Data Flow session", () => {
  const review = { review: { keyInsights: [{ title: "Route risk", detail: "Review the route." }] } };

  assert.deepEqual(getPersistedITDataFlowReviewState({ aiReview: review }), {
    aiReview: review,
    aiReviewState: "complete"
  });
  assert.deepEqual(getPersistedITDataFlowReviewState({}), {
    aiReview: null,
    aiReviewState: "idle"
  });
});

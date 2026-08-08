import assert from "node:assert/strict";
import test from "node:test";
import {
  getPersistedSurveyReviewState,
  getSurveyLifecycleStages,
  isAcceptedSurveyFile,
  surveyPreviewCounts
} from "../app/routes/survey-csv-state.mjs";

test("accepts only CSV and Excel survey files", () => {
  assert.equal(isAcceptedSurveyFile({ name: "responses.csv" }), true);
  assert.equal(isAcceptedSurveyFile({ name: "responses.XLSX" }), true);
  assert.equal(isAcceptedSurveyFile({ name: "responses.xls" }), true);
  assert.equal(isAcceptedSurveyFile({ name: "responses.pdf" }), false);
  assert.equal(isAcceptedSurveyFile({ name: "responses.csv.exe" }), false);
  assert.equal(isAcceptedSurveyFile({ name: "responses" }), false);
});

test("uses the survey lifecycle labels and CSS-compatible states", () => {
  const stages = getSurveyLifecycleStages([]);

  assert.deepEqual(stages.map((stage) => stage.label), [
    "Capture",
    "Profile",
    "Clean",
    "Standardise",
    "Validate",
    "Publish"
  ]);
  assert.deepEqual(stages.map((stage) => stage.state), [
    "active",
    "pending",
    "pending",
    "pending",
    "pending",
    "pending"
  ]);

  const allowedStates = new Set(["complete", "active", "pending", "needs_review"]);
  assert.equal(stages.every((stage) => allowedStates.has(stage.state)), true);
});

test("normalizes server lifecycle stages to supported CSS states", () => {
  const stages = getSurveyLifecycleStages([
    { key: "capture", state: "done" },
    { key: "profile", state: "in_progress" },
    { key: "clean", state: "blocked" }
  ]);

  assert.deepEqual(stages.map((stage) => stage.state), ["complete", "active", "needs_review", "pending", "pending", "pending"]);
});

test("matches partial keyed lifecycle stages by key instead of position", () => {
  const stages = getSurveyLifecycleStages([
    { key: "clean", state: "blocked" },
    { key: "capture", state: "done" }
  ]);

  assert.deepEqual(stages.map((stage) => stage.state), ["complete", "pending", "needs_review", "pending", "pending", "pending"]);
});

test("aggregates uploaded worksheet preview counts", () => {
  const counts = surveyPreviewCounts({
    files: [
      {
        sheets: [
          { columns: ["id", "rating"], cleaning: { cleanedRows: 12, mappingExceptions: 2 } },
          { columns: ["id", "route", "date"], cleaning: { cleanedRows: 8, mappingExceptions: 1 } }
        ]
      },
      {
        sheets: [
          { columns: ["id"], cleaning: { cleanedRows: 5, mappingExceptions: 3 } }
        ]
      }
    ]
  });

  assert.deepEqual(counts, { cleanedRows: 25, columns: 6, mappingExceptions: 6 });
});

test("restores the completed MIA review from the uploaded survey session", () => {
  const review = { review: { datasetSummary: "Responses are ready for review." } };

  assert.deepEqual(getPersistedSurveyReviewState({ aiReview: review }), {
    aiReview: review,
    aiReviewState: "complete"
  });
  assert.deepEqual(getPersistedSurveyReviewState({}), {
    aiReview: null,
    aiReviewState: "idle"
  });
});

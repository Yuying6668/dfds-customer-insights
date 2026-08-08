import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/routes/SurveyCsvRoute.jsx", import.meta.url), "utf8");

test("Survey CSV contains the approved workflow regions", () => {
  for (const expected of [
    "Upload a survey CSV",
    "MIA summary",
    "Questionnaire standardisation preview",
    "Standardised responses",
    "Question mapping",
    "Exceptions"
  ]) {
    assert.match(source, new RegExp(expected));
  }
  assert.match(source, /onUploadedBatchChange/);
});

test("Survey CSV renders the full persisted MIA business briefing", () => {
  for (const expected of [
    "What the uploaded data shows",
    "Dataset Overview",
    "Main Business Topics",
    "Key Insights"
  ]) {
    assert.match(source, new RegExp(expected));
  }
  assert.match(source, /getPersistedSurveyReviewState/);
});

test("Survey CSV lets an operator expand an exception sheet into its affected rows", () => {
  assert.match(source, /Review rows/);
  assert.match(source, /ExceptionRowReview/);
});

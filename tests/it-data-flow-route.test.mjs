import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/routes/ITDataFlowRoute.jsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/styles.css", import.meta.url), "utf8");

test("IT Data Flow exposes mapping exceptions in the cleaned-data preview", () => {
  for (const expected of [
    "Standardised data",
    "Exceptions",
    "Values could not be mapped to the data standard."
  ]) {
    assert.match(source, new RegExp(expected));
  }
  assert.match(source, /workbookPreviewTab/);
});

test("IT Data Flow rehydrates the persisted MIA review", () => {
  assert.match(source, /getPersistedITDataFlowReviewState/);
});

test("IT Data Flow lets an operator expand an exception sheet into its affected rows", () => {
  assert.match(source, /Review rows/);
  assert.match(source, /ExceptionRowReview/);
});

test("exception sheet rows keep the review action on the same adaptive row", () => {
  assert.match(css, /\.survey-mapping-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(120px,\s*0\.65fr\)\s+minmax\(220px,\s*1fr\)\s+auto\s+auto/);
});

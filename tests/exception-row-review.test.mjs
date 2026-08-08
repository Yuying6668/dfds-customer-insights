import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/components/ExceptionRowReview.jsx", import.meta.url), "utf8");

test("exception review loads only affected rows with field-level details", () => {
  for (const expected of ["Exception rows", "exceptions_only=true", "exceptionDetails", "Restricted fields remain masked"]) {
    assert.match(source, new RegExp(expected));
  }
});

test("exception review highlights original values that need checking", () => {
  assert.match(source, /exception-metric-value/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { normalizePath } from "../app/lib/router.js";

test("opens IT Data Flow from the root route", () => {
  assert.equal(normalizePath("/"), "/it-data-flow");
});

test("keeps the Overview route available", () => {
  assert.equal(normalizePath("/overview"), "/overview");
});

test("keeps the administrator monitoring route available", () => {
  assert.equal(normalizePath("/agent-control"), "/agent-control");
});

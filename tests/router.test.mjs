import assert from "node:assert/strict";
import test from "node:test";
import { navigate, normalizePath, normalizedPathWithSearch } from "../app/lib/router.js";

test("opens IT Data Flow from the root route", () => {
  assert.equal(normalizePath("/"), "/it-data-flow");
});

test("keeps the Overview route available", () => {
  assert.equal(normalizePath("/overview"), "/overview");
});

test("keeps the administrator monitoring route available", () => {
  assert.equal(normalizePath("/agent-control"), "/agent-control");
});

test("keeps the selected dataset when navigating between insight pages", () => {
  const originalWindow = globalThis.window;
  const events = [];
  globalThis.window = {
    location: { href: "https://mia.test/overview?datasetRun=batch-1", pathname: "/overview" },
    history: { pushState: (_state, _title, target) => { globalThis.window.location.pathname = new URL(target, globalThis.window.location.href).pathname; globalThis.window.location.href = `https://mia.test${target}`; } },
    dispatchEvent: (event) => events.push(event.type)
  };

  try {
    navigate("/customer-voice");
    assert.equal(globalThis.window.location.href, "https://mia.test/customer-voice?datasetRun=batch-1");
    assert.deepEqual(events, ["dfds:navigate"]);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("keeps the selected dataset when normalizing the root route", () => {
  assert.equal(normalizedPathWithSearch("/", "?datasetRun=batch-1"), "/it-data-flow?datasetRun=batch-1");
});

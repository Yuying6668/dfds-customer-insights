import test from "node:test";
import assert from "node:assert/strict";
import { displayBrandText } from "../app/lib/brand-display.mjs";

test("maps visible legacy brand text to Mia's Cruises", () => {
  assert.equal(displayBrandText("DFDS Passenger app"), "Mia's Cruises Passenger app");
  assert.equal(displayBrandText("dfds customer insights"), "Mia's Cruises customer insights");
});

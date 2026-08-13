import assert from "node:assert/strict";
import test from "node:test";
import { monitoringMotion } from "../app/lib/agent-monitoring-motion.mjs";
import { agentHandoffMotion } from "../app/lib/agent-monitoring-motion.mjs";

test("maps higher event volume to more connection packets", () => {
  const quiet = monitoringMotion({ requests: 12, avg_latency_ms: 120, records: 400 });
  const busy = monitoringMotion({ requests: 38, avg_latency_ms: 120, records: 400 });

  assert.ok(busy.packets > quiet.packets);
  assert.ok(busy.packetSeconds < quiet.packetSeconds);
});

test("maps elevated latency to the warning motion profile", () => {
  const motion = monitoringMotion({ requests: 37, avg_latency_ms: 320, records: 1800 });

  assert.equal(motion.tone, "warn");
  assert.ok(motion.packetSeconds > 2);
  assert.ok(motion.ragSeconds < 1.5);
});

test("maps aggregate simulated traffic to bidirectional agent handoffs", () => {
  const motion = agentHandoffMotion({ requests: 166, totalTokens: 145000, routeCount: 4 });

  assert.ok(motion.forwardPackets >= 4);
  assert.ok(motion.returnPackets >= 2);
  assert.ok(motion.handoffSeconds < 2);
});

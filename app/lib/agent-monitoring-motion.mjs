export function monitoringMotion({ requests = 0, avg_latency_ms: latency = 0, records = 0 } = {}) {
  const safeRequests = Math.max(0, Number(requests) || 0);
  const safeLatency = Math.max(0, Number(latency) || 0);
  const safeRecords = Math.max(0, Number(records) || 0);
  const packets = Math.max(1, Math.min(5, Math.ceil(safeRequests / 10)));
  const packetSeconds = Math.max(1.15, Math.min(4.2, 3.8 - safeRequests / 22 + safeLatency / 700));
  const ragSeconds = Math.max(0.65, Math.min(2.2, 1.68 - safeRecords / 4200 + safeLatency / 1800));
  return {
    packets,
    packetSeconds: Number(packetSeconds.toFixed(2)),
    ragSeconds: Number(ragSeconds.toFixed(2)),
    tone: safeLatency > 260 ? "warn" : "healthy"
  };
}

export function agentHandoffMotion({ requests = 0, totalTokens = 0, routeCount = 0 } = {}) {
  const safeRequests = Math.max(0, Number(requests) || 0);
  const safeTokens = Math.max(0, Number(totalTokens) || 0);
  const safeRoutes = Math.max(1, Number(routeCount) || 1);
  return {
    forwardPackets: Math.max(2, Math.min(7, Math.ceil(safeRequests / 32))),
    returnPackets: Math.max(1, Math.min(5, Math.ceil(safeRoutes / 2))),
    handoffSeconds: Number(Math.max(0.85, Math.min(2.8, 2.7 - safeRequests / 120 - safeTokens / 600000)).toFixed(2)),
    agentPulseSeconds: Number(Math.max(0.8, Math.min(2.2, 2.1 - safeTokens / 260000)).toFixed(2))
  };
}

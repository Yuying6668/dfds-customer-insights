export const INSIGHT_CONCEPTS = {
  "customer-voice": new Set(["rating", "nps", "csat"]),
  "app-reviews": new Set(["app_review_rating"]),
  "passenger-profile": new Set(["route", "market", "country", "language", "bookings", "revenue"]),
  competitors: new Set(["rating", "market"])
};

export function datasetSupportsInsight(route, analytics) {
  const available = analytics?.schemaAvailability?.availableConcepts || [];
  const required = INSIGHT_CONCEPTS[route];
  return Boolean(required && available.some((concept) => required.has(concept)));
}

export function datasetRunNavigationSnapshot(run) {
  if (!run?.batchId) return null;
  const datasetRun = run.datasetRun || {};
  return {
    batchId: run.batchId,
    version: run.version,
    publishedAt: datasetRun.publishedAt,
    analysisState: datasetRun.analysisState,
    schemaAvailability: { availableConcepts: datasetRun.lineage?.availableConcepts || [] }
  };
}

export function mergeDatasetRunNavigationSnapshot(current, run) {
  const next = datasetRunNavigationSnapshot(run);
  if (!next) return current || null;
  return { ...current, ...next, schemaAvailability: next.schemaAvailability };
}

export function getInsightNavigationState(route, { activeDatasetRun, analytics } = {}) {
  const analysisState = analytics?.analysisState;
  if (!activeDatasetRun || activeDatasetRun === "public" || !["ready", "processing", "not_started"].includes(analysisState) || !datasetSupportsInsight(route, analytics)) return null;
  const version = String(analytics?.version || "unknown");
  const updating = analysisState === "processing" || analysisState === "not_started";
  return { status: updating ? "updating" : "updated", version, label: `${updating ? "Updating" : "Updated"} · ${version}` };
}

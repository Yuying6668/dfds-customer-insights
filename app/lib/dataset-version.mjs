export function isDatasetAnalysisProcessing(analytics = {}) {
  return analytics.analysisState === "processing" || analytics.analysisState === "not_started";
}

export function getDatasetAnalysisState(analytics = {}) {
  if (analytics.error || analytics.analysisState === "failed") return "failed";
  return isDatasetAnalysisProcessing(analytics) ? "processing" : "ready";
}

export function getDatasetVersionMeta(analytics = {}) {
  const version = String(analytics.version || "unknown");
  const status = getDatasetAnalysisState(analytics);
  const timestamp = String((status === "processing" ? analytics.publishedAt : analytics.generatedAt) || analytics.generatedAt || analytics.publishedAt || "");
  return {
    version,
    timestamp,
    status,
    label: `${status === "processing" ? "Updating" : status === "failed" ? "Analysis failed" : "Updated"} · ${version}`
  };
}

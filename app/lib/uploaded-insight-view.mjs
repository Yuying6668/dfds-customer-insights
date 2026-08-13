const LABELS = {
  route: "Route distribution",
  market: "Market distribution",
  country: "Country distribution",
  language: "Language distribution"
};

export function buildUploadedInsightView(analytics = {}) {
  const dimensions = Object.entries(analytics.distributions || {})
    .map(([concept, values]) => {
      const total = Object.values(values || {}).reduce((sum, value) => sum + Number(value || 0), 0);
      return {
        concept,
        label: LABELS[concept] || `${concept.replaceAll("_", " ")} distribution`,
        values: Object.entries(values || {})
          .map(([label, count]) => ({ label, count: Number(count || 0), share: total ? `${((Number(count || 0) / total) * 100).toFixed(1)}%` : "0.0%" }))
          .sort((left, right) => right.count - left.count)
      };
    })
    .filter((dimension) => dimension.values.length);
  const quality = analytics.quality || {};
  return {
    version: String(analytics.version || "unknown"),
    generatedAt: String(analytics.generatedAt || ""),
    recordCount: Number(analytics.datasetOverview?.recordCount || 0),
    quality: `${Number(quality.mappingExceptions || 0)} mapping exceptions · ${Number(quality.invalidValues || 0)} invalid values`,
    dimensions
  };
}

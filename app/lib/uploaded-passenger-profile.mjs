function formatNumber(value) {
  return new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

export function buildUploadedPassengerProfile(analytics = {}) {
  const routes = Object.entries(analytics.distributions?.route || {});
  const totalRoutes = routes.reduce((total, [, count]) => total + Number(count || 0), 0);
  const revenue = analytics.metrics?.revenue || {};
  const quality = analytics.quality || {};
  return {
    version: String(analytics.version || "unknown"),
    recordCount: Number(analytics.datasetOverview?.recordCount || 0),
    revenue: Object.entries(revenue.currencies || {}).map(([currency, value]) => `${formatNumber(value.sum)} ${currency}`),
    revenueSampleSize: Number(revenue.sampleSize || 0),
    routes: routes
      .map(([label, count]) => ({ label, count: Number(count || 0), share: totalRoutes ? `${((Number(count || 0) / totalRoutes) * 100).toFixed(1)}%` : "0.0%" }))
      .sort((left, right) => right.count - left.count),
    quality: `${Number(quality.mappingExceptions || 0)} mapping exceptions · ${Number(quality.invalidValues || 0)} invalid values`,
    generatedAt: String(analytics.generatedAt || "")
  };
}

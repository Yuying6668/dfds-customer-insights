function formatMetricNumber(value) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

export function displayDatasetMetric(metric = {}) {
  if (metric.currencies) {
    return Object.entries(metric.currencies)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, value]) => `${formatMetricNumber(value.sum)} ${currency}`)
      .join(" · ");
  }
  return String(metric.average ?? metric.sum ?? "-");
}

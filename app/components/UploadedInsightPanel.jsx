import React from "react";
import { MetricCard, Panel } from "./common.jsx";
import { getDatasetVersionMeta } from "../lib/dataset-version.mjs";
import { displayDatasetMetric } from "../lib/dataset-metric-display.mjs";

export function UploadedInsightPanel({ analytics, title = "Uploaded data signal" }) {
  if (!analytics) return null;
  const versionMeta = getDatasetVersionMeta(analytics);
  const metrics = Object.entries(analytics.metrics || {});
  return <Panel title={title} eyebrow={`Live dataset · ${versionMeta.version}`} pill={`${analytics.datasetOverview?.recordCount || 0} records`}>
    <div className={`dataset-version-status ${versionMeta.status}`} role="status"><strong>{versionMeta.label}</strong>{versionMeta.timestamp ? <time dateTime={versionMeta.timestamp}>{versionMeta.status === "processing" ? "Published " : "Updated "}{versionMeta.timestamp}</time> : null}</div>
    <div className="summary-grid">{metrics.length ? metrics.map(([key, value]) => <MetricCard key={key} label={key.toUpperCase()} value={displayDatasetMetric(value)} detail={`${value.sampleSize || 0} observations`} />) : <p className="panel-note">The uploaded dataset has no aggregate metrics for this view yet.</p>}</div>
  </Panel>;
}

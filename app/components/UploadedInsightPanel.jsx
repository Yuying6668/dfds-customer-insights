import React from "react";
import { MetricCard, Panel } from "./common.jsx";

export function UploadedInsightPanel({ analytics, title = "Uploaded data signal" }) {
  if (!analytics) return null;
  const metrics = Object.entries(analytics.metrics || {});
  return <Panel title={title} eyebrow={`Live dataset · ${analytics.version || "published"}`} pill={`${analytics.datasetOverview?.recordCount || 0} records`}>
    <div className="summary-grid">{metrics.length ? metrics.map(([key, value]) => <MetricCard key={key} label={key.toUpperCase()} value={String(value.average ?? value.sum ?? "-")} detail={`${value.sampleSize || 0} observations`} />) : <p className="panel-note">The uploaded dataset has no aggregate metrics for this view yet.</p>}</div>
  </Panel>;
}

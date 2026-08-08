import React, { useEffect, useState } from "react";
import { BulletList, MetricCard, Panel, PageSummary } from "../components/common.jsx";
import { compareDatasetRuns, getDatasetRunAnalytics, listDatasetRuns, retryDatasetRun, subscribeDatasetRun } from "../scripts/services/dataset-run-api.mjs";

function parseRating(value) {
  const match = String(value || "").match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
}

function parseReviewCount(value) {
  const match = String(value || "").replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function OverviewRoute({ data, routeFocus }) {
  const datasetRunId = new URLSearchParams(window.location.search).get("datasetRun");
  const [datasetAnalytics, setDatasetAnalytics] = useState(null);
  const [datasetState, setDatasetState] = useState(datasetRunId ? "loading" : "public");
  const [runs, setRuns] = useState([]); const [baselineId, setBaselineId] = useState(""); const [comparison, setComparison] = useState(null);
  useEffect(() => {
    if (!datasetRunId) { setDatasetAnalytics(null); setDatasetState("public"); return undefined; }
    setDatasetState("loading");
    getDatasetRunAnalytics(datasetRunId)
      .then((payload) => { setDatasetAnalytics(payload); setDatasetState(payload.analysisState ? "processing" : "ready"); })
      .catch(() => setDatasetState("failed"));
    return subscribeDatasetRun(datasetRunId, (status) => {
      const state = status.datasetRun?.analysisState;
      if (state === "ready") getDatasetRunAnalytics(datasetRunId).then((payload) => { setDatasetAnalytics(payload); setDatasetState("ready"); }).catch(() => setDatasetState("failed"));
      if (state === "failed") setDatasetState("failed");
    });
  }, [datasetRunId]);
  useEffect(() => { if (datasetRunId) listDatasetRuns().then((items) => { setRuns(items); const match = items.find((item) => item.batchId !== datasetRunId && item.datasetRun?.lineage?.schemaFingerprint === datasetAnalytics?.schemaAvailability?.schemaFingerprint); if (match) setBaselineId(match.batchId); }).catch(() => setRuns([])); }, [datasetRunId, datasetAnalytics?.schemaAvailability?.schemaFingerprint]);
  useEffect(() => { if (datasetRunId && baselineId) compareDatasetRuns(datasetRunId, baselineId).then(setComparison).catch(() => setComparison({ error: true })); else setComparison(null); }, [datasetRunId, baselineId]);
  if (datasetRunId) {
    if (datasetState === "loading" || datasetState === "processing") return <section className="view active"><PageSummary title="Dataset analysis is still processing" description="The published dataset is being prepared for insights." points={[]} /></section>;
    if (datasetState === "failed" || !datasetAnalytics) return <section className="view active"><PageSummary title="Dataset analysis is unavailable" description="This dataset could not be loaded. You can retry its analysis without uploading again." points={[]} /><button className="primary-button" type="button" onClick={() => { setDatasetState("processing"); retryDatasetRun(datasetRunId).catch(() => setDatasetState("failed")); }}>Retry analysis</button></section>;
    const metrics = Object.entries(datasetAnalytics.metrics || {});
    return <section className="view active"><PageSummary title="Uploaded dataset insights" description={`Version ${datasetAnalytics.version || "unknown"}, generated ${datasetAnalytics.generatedAt || "unknown"}.`} points={[{ label: "Records", text: String(datasetAnalytics.datasetOverview?.recordCount || 0) }, { label: "Quality", text: `${datasetAnalytics.quality?.mappingExceptions || 0} mapping exceptions` }]} /><div className="summary-grid">{metrics.length ? metrics.map(([key, value]) => <MetricCard key={key} label={key.toUpperCase()} value={String(value.average ?? value.sum ?? "-")} detail={`${value.sampleSize || 0} observations`} />) : <p>This uploaded schema does not support overview metrics.</p>}</div><Panel title="Version comparison" eyebrow="Change evidence">{runs.length > 1 ? <><select value={baselineId} onChange={(event) => setBaselineId(event.target.value)} aria-label="Comparison baseline"><option value="">Choose baseline</option>{runs.filter((item) => item.batchId !== datasetRunId).map((item) => <option key={item.batchId} value={item.batchId}>{item.version}</option>)}</select>{comparison?.changes?.map((item) => <p key={item.metric}><strong>{item.metric}</strong>: {item.current} vs {item.baseline} ({item.change >= 0 ? "+" : ""}{item.change})</p>)}</> : <p>No compatible previous version is available.</p>}</Panel><Panel title="Dataset findings" eyebrow="Published run"><BulletList items={(datasetAnalytics.insights || []).map((item) => `${item.type}: ${item.evidence?.metric || "signal"} ${item.evidence?.value ?? ""}`)} /></Panel></section>;
  }
  const route = data.routeInsights[routeFocus] || data.routeInsights.all;
  const maxLocationReviews = Math.max(
    ...data.googleReviewLocations.map((location) => parseReviewCount(location.reviews) || 0)
  );

  return (
    <section className="view active">
      <PageSummary
        title="Start here if you only have two minutes"
        description="This page gives you the quick health check: how Mia's Cruises looks in public reviews, where customers seem unhappy, and what needs attention first."
        points={[
          { label: "Look first", text: `Brand score, app score, and ${route.title}.` },
          { label: "Main question", text: "Is Mia's Cruises building trust, or are there warning signs?" },
          { label: "Use it for", text: "Choosing the first topic to discuss with the team." }
        ]}
      />

      <div className="summary-grid">
        <MetricCard label="Brand reviews" value="4.2 / 5" detail="Trustpilot: 20,646 reviews." />
        <MetricCard
          label="Android app"
          value="2.5 / 5"
          detail="Google Play GB: 64 reviews."
          warning
        />
        <MetricCard label="iOS app" value="3.3 / 5" detail="Apple GB: 10 ratings." />
      </div>

      <div className="content-grid">
        <Panel title={route.title} eyebrow="Route lens" pill={route.status} className="wide">
          <div className="route-lens">
            <article>
              <span>Why selected</span>
              <strong>{route.reason}</strong>
            </article>
            <article>
              <span>Main risk</span>
              <strong>{route.risk}</strong>
            </article>
            <article>
              <span>Next action</span>
              <strong>{route.action}</strong>
            </article>
          </div>
        </Panel>

        <Panel title="Main data sources" eyebrow="Source coverage" className="wide">
          <div className="coverage-grid">
            {data.sourceCoverage.map((source) => (
              <article className="coverage-item" key={source.source}>
                <div className="item-top">
                  <h4>
                    {source.logo ? (
                      <img className="coverage-logo" src={source.logo} alt={`${source.source} logo`} />
                    ) : (
                      <span className="file-logo">CSV</span>
                    )}
                    {source.source}
                  </h4>
                  <span className="pill">{source.status}</span>
                </div>
                <p>
                  <strong>{source.records}</strong>
                </p>
                <p>{source.insight}</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Google Reviews by ferry location" eyebrow="Location reviews" className="wide">
          <div className="location-chart">
            {data.googleReviewLocations.map((location) => (
              <article className="location-row" key={location.name}>
                <div>
                  <h4>{location.name}</h4>
                  <p>{data.routeInsights[location.route]?.title || location.route}</p>
                </div>
                <div className="location-bars">
                  <div>
                    <span>Rating</span>
                    <div className="mini-track">
                      <i style={{ width: `${Math.round((parseRating(location.rating) / 5) * 100)}%` }} />
                    </div>
                    <strong>{location.rating}</strong>
                  </div>
                  <div>
                    <span>Review volume</span>
                    <div className="mini-track muted">
                      <i
                        style={{
                          width: `${Math.max(
                            8,
                            Math.round((parseReviewCount(location.reviews) / maxLocationReviews) * 100)
                          )}%`
                        }}
                      />
                    </div>
                    <strong>{location.reviews}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Customer temperature" eyebrow="Sentiment mix">
          <div className="temperature-bar" aria-label="Positive, neutral, and negative customer temperature mix">
            {data.sentimentMix.map((item) => (
              <span
                key={item.label}
                className="temperature-segment"
                style={{ width: `${item.value}%`, background: item.color }}
                title={`${item.label}: ${item.value}%`}
              />
            ))}
          </div>
          <div className="temperature-legend">
            {data.sentimentMix.map((item) => (
              <div key={item.label}>
                <span className="legend-dot" style={{ background: item.color }} />
                <strong>{item.label}</strong>
                <em>{item.value}%</em>
                <small>{item.note}</small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="What is pulling satisfaction down?" eyebrow="Root causes">
          <BulletList items={data.rootCauses.map((item) => `${item.title}: ${item.summary}`)} />
        </Panel>
      </div>
    </section>
  );
}

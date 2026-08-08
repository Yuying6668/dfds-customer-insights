import React, { useEffect, useState } from "react";
import { Panel, PageSummary } from "../components/common.jsx";
import { getDatasetRunAnalytics, subscribeDatasetRun } from "../scripts/services/dataset-run-api.mjs";

function routeMatches(routeFocus, routes) {
  return routeFocus === "all" || routes.includes(routeFocus);
}

const priorityOrder = {
  Urgent: 0,
  High: 0,
  Medium: 1,
  Low: 2
};

function priorityClass(priority) {
  return `${String(priority || "low").toLowerCase()}-priority`;
}

export function RecommendationsRoute({ data, routeFocus }) {
  const datasetRunId = new URLSearchParams(window.location.search).get("datasetRun");
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    if (!datasetRunId) { setSnapshot(null); return undefined; }
    getDatasetRunAnalytics(datasetRunId).then(setSnapshot).catch(() => setSnapshot({ error: true }));
    return subscribeDatasetRun(datasetRunId, (status) => {
      if (status.datasetRun?.analysisState === "ready") getDatasetRunAnalytics(datasetRunId).then(setSnapshot).catch(() => setSnapshot({ error: true }));
      if (status.datasetRun?.analysisState === "failed") setSnapshot({ error: true });
    });
  }, [datasetRunId]);
  if (datasetRunId) {
    if (!snapshot || snapshot.analysisState) return <section className="view active"><PageSummary title="Dataset decisions are processing" description="Recommendations will appear when the published run analysis is ready." points={[]} /></section>;
    if (snapshot.error) return <section className="view active"><PageSummary title="Dataset decisions are unavailable" description="The selected dataset could not be loaded." points={[]} /></section>;
    return <section className="view active"><PageSummary title="Recommendations from uploaded data" description={`Dataset ${snapshot.version || "unknown"} · analysis ${snapshot.analysisVersion || "unknown"}`} points={[]} /><Panel title="Recommended actions" eyebrow="Dataset run"><div className="recommendation-list">{(snapshot.recommendations || []).length ? snapshot.recommendations.map((item) => <article key={item.type} className="recommendation-item"><h3>{item.type.replaceAll("_", " ")}</h3><p>Evidence: {item.evidence?.metric} {item.evidence?.value}</p><small>Batch {snapshot.batchId} · Quality exceptions: {item.qualityContext?.mappingExceptions || 0}</small></article>) : <p>This uploaded schema does not support decision recommendations.</p>}</div></Panel></section>;
  }
  const items = data.recommendations
    .filter((item) => routeMatches(routeFocus, item.routes))
    .slice()
    .sort((a, b) => {
      const priorityDelta = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
      if (priorityDelta !== 0) return priorityDelta;
      return a.title.localeCompare(b.title);
    });

  return (
    <section className="view active">
      <PageSummary
        title="Practical next steps"
        description="This page turns the public evidence into clear actions for Marketing and CX, with the route context attached."
        points={[
          { label: "Look first", text: "Start with the high-priority recommendations." },
          { label: "Watch for", text: "Actions that need route-specific messaging or recovery work." },
          { label: "Use it for", text: "Deciding what to fix first and what to explain better." }
        ]}
      />

      <Panel title="Recommended actions" eyebrow="Recommendations" pill={routeFocus}>
        <div className="recommendation-list">
          {items.map((item) => (
            <article key={item.title} className={`recommendation-item ${priorityClass(item.priority)}`}>
              <div className="panel-header">
                <div>
                  <p className="eyebrow">{item.priority}</p>
                  <h3>{item.title}</h3>
                </div>
                <span className="pill">{item.routes.join(", ")}</span>
              </div>
              <p>{item.reasoning}</p>
              <p><strong>Expected improvement:</strong> {item.expectedImprovement}</p>
              {item.evidence ? <small>{item.evidence}</small> : null}
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

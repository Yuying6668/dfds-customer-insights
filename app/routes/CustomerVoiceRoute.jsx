import React from "react";
import { BulletList, Panel, PageSummary } from "../components/common.jsx";
import { UploadedInsightPanel } from "../components/UploadedInsightPanel.jsx";
import { UploadedInsightView } from "../components/UploadedInsightView.jsx";
import { useDatasetInsight } from "../hooks/use-dataset-insight.mjs";

function routeMatches(routeFocus, routes) {
  return routeFocus === "all" || routes.includes(routeFocus);
}

const sentimentOrder = {
  Negative: 0,
  Mixed: 1,
  "Mixed-positive": 2,
  Positive: 3
};

function sentimentRank(sentiment) {
  return sentimentOrder[sentiment] ?? 4;
}

function priorityTone(sentiment) {
  if (sentiment === "Negative") return "high";
  if (sentiment === "Mixed" || sentiment === "Mixed-positive") return "medium";
  if (sentiment === "Positive") return "green";
  return "neutral";
}

function priorityLabel(sentiment) {
  if (sentiment === "Negative") return "High attention";
  if (sentiment === "Mixed" || sentiment === "Mixed-positive") return "Watch";
  if (sentiment === "Positive") return "Strength";
  return "Signal";
}

function routePriority(routeFocus, routes) {
  if (routeFocus === "all") return routes.includes("all") ? 0 : 1;
  return routes.includes(routeFocus) ? 0 : 1;
}

export function CustomerVoiceRoute({ data, routeFocus }) {
  const { analytics, loading, supported } = useDatasetInsight("customer-voice");
  if (loading) return <section className="view active"><PageSummary title="Uploaded data is processing" description="Customer Voice will refresh when the published analysis is ready." points={[]} /></section>;
  if (supported && analytics) return <UploadedInsightView analytics={analytics} title="Customer Voice" description="Customer feedback metrics and distributions are" />;
  const routeSignals = data.signals
    .filter((item) => routeMatches(routeFocus, [item.route]))
    .slice()
    .sort((a, b) => sentimentRank(a.sentiment) - sentimentRank(b.sentiment));
  const routeThemes = data.voiceThemes
    .filter((item) => routeMatches(routeFocus, item.routes))
    .slice()
    .sort((a, b) => {
      const routeDelta = routePriority(routeFocus, a.routes) - routePriority(routeFocus, b.routes);
      if (routeDelta !== 0) return routeDelta;
      return sentimentRank(a.sentiment) - sentimentRank(b.sentiment);
    });

  return (
    <section className="view active">
      <PageSummary
        title="See what customers keep saying"
        description="This page groups public comments into clear themes, so you can quickly see what people praise, complain about, or repeat often."
        points={[
          { label: "Look first", text: "Choose a route if you want a route-specific view." },
          { label: "Watch for", text: "Problems that appear in more than one public source." },
          { label: "Use it for", text: "Finding the customer issues behind the numbers." }
        ]}
      />

      <Panel title="What customers are telling Mia's Cruises" eyebrow="Customer voice" pill={routeFocus}>
        <div className="voice-summary">
          {routeSignals.map((signal) => (
            <article
              key={`${signal.source}-${signal.theme}`}
              className={`voice-summary-card priority-${priorityTone(signal.sentiment)}`}
            >
              <div className="voice-card-top">
                <span className={`pill ${priorityTone(signal.sentiment)}`}>
                  {priorityLabel(signal.sentiment)}
                </span>
                <small>{signal.source}</small>
              </div>
              <h3>{signal.theme}</h3>
              <p>{signal.evidence}</p>
              <strong>{signal.businessMeaning}</strong>
              <small>{signal.journeyStage}</small>
            </article>
          ))}
        </div>
        <div className="theme-list">
          {routeThemes.map((theme) => (
            <article key={theme.theme} className={`theme-card priority-${priorityTone(theme.sentiment)}`}>
              <div className="panel-header compact">
                <div>
                  <p className="eyebrow">{theme.sentiment}</p>
                  <h3>{theme.theme}</h3>
                </div>
                <span className={`pill ${priorityTone(theme.sentiment)}`}>
                  {priorityLabel(theme.sentiment)}
                </span>
              </div>
              <p className="theme-route-label">{theme.routeLabel}</p>
              <div className="theme-action-grid">
                <div>
                  <span>Customer meaning</span>
                  <strong>{theme.customerMeaning}</strong>
                </div>
                <div>
                  <span>Marketing action</span>
                  <strong>{theme.marketingAction}</strong>
                </div>
              </div>
              <BulletList items={theme.evidence} />
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

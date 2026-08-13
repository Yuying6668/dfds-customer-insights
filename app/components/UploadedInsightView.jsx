import React from "react";
import { Panel, PageSummary } from "./common.jsx";
import { UploadedInsightPanel } from "./UploadedInsightPanel.jsx";
import { buildUploadedInsightView } from "../lib/uploaded-insight-view.mjs";

export function UploadedInsightView({ analytics, title, description }) {
  const view = buildUploadedInsightView(analytics);
  return <section className="view active">
    <PageSummary
      eyebrow="Uploaded dataset"
      title={title}
      description={`${description} Version ${view.version} is calculated from the selected upload, not the public benchmark.`}
      points={[{ label: "Records", text: view.recordCount.toLocaleString() }, { label: "Quality", text: view.quality }]}
    />
    <UploadedInsightPanel analytics={analytics} title={title} />
    {view.dimensions.map((dimension) => <Panel key={dimension.concept} title={dimension.label} eyebrow="Uploaded data" pill={`${dimension.values.length} values`}>
      <div className="profile-slice-bars">{dimension.values.map((item) => <article key={item.label} className="profile-slice-row"><div><strong>{item.label}</strong><span>{item.count.toLocaleString()} uploaded records</span></div><em>{item.share}</em></article>)}</div>
    </Panel>)}
    <Panel title="Analysis basis" eyebrow="Dataset version" pill={view.version}><p className="panel-note">Generated {view.generatedAt || "unknown"}. Public benchmark content is hidden while this uploaded dataset is selected.</p></Panel>
  </section>;
}

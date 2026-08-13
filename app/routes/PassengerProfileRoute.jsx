import React from "react";
import { DataTable, MetricCard, Panel, PageSummary } from "../components/common.jsx";
import { UploadedInsightPanel } from "../components/UploadedInsightPanel.jsx";
import { useDatasetInsight } from "../hooks/use-dataset-insight.mjs";

function SliceBars({ items, valueKey = "trips" }) {
  const maxValue = Math.max(...items.map((item) => Number(item[valueKey]) || 0), 1);
  return (
    <div className="profile-slice-bars">
      {items.map((item) => (
        <article key={item.label} className="profile-slice-row">
          <div>
            <strong>{item.label}</strong>
            <span>{item.signal || `${item.share} of synthetic trips`}</span>
          </div>
          <div className="mini-track">
            <i style={{ width: `${Math.max(8, Math.round((Number(item[valueKey]) / maxValue) * 100))}%` }} />
          </div>
          <em>{item.share}</em>
        </article>
      ))}
    </div>
  );
}

export function PassengerProfileRoute({ data }) {
  const { analytics, loading, supported } = useDatasetInsight("passenger-profile");
  const profile = data.passengerProfileSummary;
  const actarRows = profile.actarSlices.map((slice) => ({
    key: `${slice.actionArea}-${slice.customerTarget}`,
    "Action area": slice.actionArea,
    "Customer target": slice.customerTarget,
    "Trigger signal": slice.triggerSignal,
    Analysis: slice.analysis,
    Recommendation: slice.recommendation
  }));

  return (
    <section className="view active">
      {loading ? <PageSummary title="Uploaded data is processing" description="Passenger Profile will refresh when the published analysis is ready." points={[]} /> : supported ? <UploadedInsightPanel analytics={analytics} title="Passenger Profile from uploaded data" /> : null}
      <PageSummary
        eyebrow="Passenger profile sub-agent"
        title="Who rides which routes, and what do they seem to prefer?"
        description="This view turns the synthetic PG passenger-profile star schema into marketing slices for route, segment, product and travel-context decisions."
        points={[
          { label: "Dataset", text: `${profile.passengerCount} synthetic passengers and ${profile.tripCount} synthetic trips.` },
          { label: "Method", text: "Cleaned star schema slices, surfaced as ACTAR recommendations." },
          { label: "Use it for", text: "Testing passenger segmentation before real CRM, booking or survey data arrives." }
        ]}
      />

      <div className="summary-grid">
        <MetricCard label="Passengers" value={profile.passengerCount.toLocaleString()} detail="Synthetic passenger profiles." />
        <MetricCard label="Trips" value={profile.tripCount.toLocaleString()} detail="Synthetic trip and booking records." />
        <MetricCard label="Routes" value={profile.routeCount} detail="Mia's Cruises-relevant route records." />
      </div>

      <div className="content-grid">
        <Panel title="User characteristics" eyebrow="Segment base" className="wide" pill={profile.status}>
          <div className="profile-feature-grid">
            {profile.topSegments.map((segment) => (
              <article key={segment.label} className="profile-feature-card">
                <span>{segment.passengers} passengers</span>
                <strong>{segment.label}</strong>
                <p>{segment.share} of the synthetic profile base.</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Route preference" eyebrow="Route slice">
          <SliceBars items={profile.routeAffinity} />
        </Panel>

        <Panel title="Product and spend preference" eyebrow="Product slice">
          <SliceBars items={profile.productPreference} />
        </Panel>

        <Panel title="Travel scene" eyebrow="Context slice" className="wide">
          <SliceBars items={profile.travelContext} />
        </Panel>

        <Panel title="ACTAR output" eyebrow="Sub-agent recommendations" className="wide">
          <DataTable
            columns={["Action area", "Customer target", "Trigger signal", "Analysis", "Recommendation"]}
            rows={actarRows}
          />
        </Panel>

        <Panel title="Source assumptions" eyebrow={profile.sourceLabel} className="wide">
          <p className="panel-note">{profile.methodology}</p>
          <div className="assumption-list">
            {profile.sourceAssumptions.map((assumption) => (
              <article key={assumption}>
                <strong>{assumption}</strong>
              </article>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}

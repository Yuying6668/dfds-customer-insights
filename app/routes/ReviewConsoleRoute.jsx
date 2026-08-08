import React, { useMemo, useState } from "react";
import { Badge, BulletList, Panel, PageSummary } from "../components/common.jsx";
import { reviewConsoleSeedItems } from "../data/review-console.mjs";

const layerOptions = ["all", "scope", "collection", "retrieval", "language", "release"];
const statusOptions = ["all", "pending", "approved", "needs_changes", "rejected"];
const severityOptions = ["all", "low", "medium", "high"];

function matchesRoute(routeFocus, item) {
  return routeFocus === "all" || item.routeScope === "all" || item.routeScope === routeFocus;
}

function matchesFilter(value, filter) {
  return filter === "all" || value === filter;
}

export function ReviewConsoleRoute({ routeFocus }) {
  const [layer, setLayer] = useState("all");
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(reviewConsoleSeedItems[0]?.id || "");

  const items = useMemo(() => {
    const text = query.trim().toLowerCase();
    return reviewConsoleSeedItems.filter((item) => {
      const haystack = [item.title, item.reason, item.recommendation, item.source, item.layer].join(" ").toLowerCase();
      return (
        matchesRoute(routeFocus, item) &&
        matchesFilter(item.layer, layer) &&
        matchesFilter(item.status, status) &&
        matchesFilter(item.severity, severity) &&
        (!text || haystack.includes(text))
      );
    });
  }, [layer, query, routeFocus, severity, status]);

  const selected = items.find((item) => item.id === selectedId) || items[0] || reviewConsoleSeedItems[0];

  return (
    <section className="view active">
      <PageSummary
        title="Internal review console"
        description="This page helps the team inspect validation and reflection results before they are exposed more widely in the dashboard."
        points={[
          { label: "Look first", text: "Use filters to narrow by layer, status, severity, or route." },
          { label: "Watch for", text: "Items with missing evidence, weak status, or route mismatches." },
          { label: "Use it for", text: "Deciding whether a result is ready to publish." }
        ]}
      />

      <Panel title="Review queue" eyebrow="Queue" pill={routeFocus}>
        <div className="review-toolbar">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, reason, or source"
          />
          <select value={layer} onChange={(event) => setLayer(event.target.value)}>
            {layerOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
            {severityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="review-layout">
          <div className="review-queue">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`review-row${selected?.id === item.id ? " active" : ""}`}
                onClick={() => setSelectedId(item.id)}
              >
                <span className="review-row-title">{item.title}</span>
                <span className="review-row-meta">{item.layer} · {item.source}</span>
                <div className="review-row-badges">
                  <span className={`review-badge status-${item.status}`}>{item.status}</span>
                  <span className={`review-badge severity-${item.severity}`}>{item.severity}</span>
                </div>
                <small>{item.reason}</small>
              </button>
            ))}
          </div>

          <div className="review-detail review-evidence">
            {selected ? (
              <>
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">{selected.layer}</p>
                    <h3>{selected.title}</h3>
                  </div>
                  <Badge tone={selected.status === "approved" ? "green" : selected.status === "rejected" ? "red" : "amber"}>
                    {selected.status}
                  </Badge>
                </div>
                <p>{selected.reason}</p>
                <p>
                  <strong>Recommendation:</strong> {selected.recommendation}
                </p>
                <p>
                  <strong>Publish state:</strong> {selected.publish_state}
                </p>
                <p>
                  <strong>Source:</strong> {selected.source}
                </p>
                <BulletList items={selected.evidence_chain.map((step) => step)} />
                <div className="review-actions">
                  {selected.artifacts.map((artifact) => (
                    <span key={artifact} className="pill">
                      {artifact}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p>No review items matched the current filters.</p>
            )}
          </div>
        </div>
      </Panel>
    </section>
  );
}

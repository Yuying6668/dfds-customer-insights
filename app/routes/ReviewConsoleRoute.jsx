import React, { useEffect, useMemo, useState } from "react";
import { Badge, BulletList, Panel, PageSummary } from "../components/common.jsx";
import { reviewConsoleSeedItems } from "../data/review-console.mjs";
import { reviewDatasetRun } from "../scripts/services/dataset-run-api.mjs";
import { getAccessToken } from "../lib/auth.js";

const layerOptions = ["all", "scope", "collection", "retrieval", "language", "release"];
const statusOptions = ["all", "pending", "pending_human_review", "approved", "corrected", "needs_changes", "rejected", "withdrawn"];
const severityOptions = ["all", "low", "medium", "high"];

function matchesRoute(routeFocus, item) {
  const itemRoute = item.routeScope || item.route_key || "all";
  return routeFocus === "all" || itemRoute === "all" || itemRoute === routeFocus;
}

function matchesFilter(value, filter) {
  return filter === "all" || value === filter;
}

export function ReviewConsoleRoute({ routeFocus, datasetRuns = [] }) {
  const [layer, setLayer] = useState("all");
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(reviewConsoleSeedItems[0]?.id || "");
  const [reviewItems, setReviewItems] = useState(reviewConsoleSeedItems);
  const [reviewAction, setReviewAction] = useState("");
  const [reviewRationale, setReviewRationale] = useState("");
  const [reviewCorrection, setReviewCorrection] = useState("");
  const [reviewActionState, setReviewActionState] = useState("");
  const [selectedDatasetRun, setSelectedDatasetRun] = useState(datasetRuns[0]?.batchId || "");
  const [datasetReviewStatus, setDatasetReviewStatus] = useState("approved");
  const [datasetReviewNote, setDatasetReviewNote] = useState("");
  const [datasetReviewState, setDatasetReviewState] = useState("");
  const [datasetReviewError, setDatasetReviewError] = useState("");

  useEffect(() => {
    if (!selectedDatasetRun && datasetRuns[0]?.batchId) setSelectedDatasetRun(datasetRuns[0].batchId);
  }, [datasetRuns, selectedDatasetRun]);

  const loadReviewItems = async () => {
    try {
      const response = await fetch("/api/review-items", { headers: { Authorization: `Bearer ${getAccessToken()}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load review queue");
      setReviewItems(payload.items?.length ? payload.items : reviewConsoleSeedItems);
    } catch {
      setReviewItems(reviewConsoleSeedItems);
    }
  };

  useEffect(() => { loadReviewItems(); }, []);

  const submitDatasetReview = async () => {
    if (!selectedDatasetRun) return;
    setDatasetReviewError("");
    setDatasetReviewState("saving");
    try {
      const result = await reviewDatasetRun(selectedDatasetRun, {
        status: datasetReviewStatus,
        reviewerId: window.localStorage.getItem("dfds-account-role") || "internal-reviewer",
        reason: datasetReviewNote
      });
      setDatasetReviewState(result.snapshot?.publication_state || "pending_human_review");
    } catch (error) {
      setDatasetReviewState("");
      setDatasetReviewError(error.message);
    }
  };

  const items = useMemo(() => {
    const text = query.trim().toLowerCase();
    return reviewItems.filter((item) => {
      const haystack = [item.title, item.reason, item.recommendation, item.source, item.layer].join(" ").toLowerCase();
      return (
        matchesRoute(routeFocus, item) &&
        matchesFilter(item.layer, layer) &&
        matchesFilter(item.status, status) &&
        matchesFilter(item.severity, severity) &&
        (!text || haystack.includes(text))
      );
    });
  }, [layer, query, reviewItems, routeFocus, severity, status]);

  const selected = items.find((item) => item.id === selectedId) || items[0] || reviewItems[0];

  const submitReviewAction = async () => {
    if (!selected || String(selected.id).startsWith("seed-") || !reviewAction) return;
    setReviewActionState("saving");
    try {
      const response = await fetch(`/api/review-items/${selected.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
        body: JSON.stringify({
          action: reviewAction,
          rationale: reviewRationale,
          correction: reviewCorrection,
          graphRunId: selected.metadata?.graph_run_id || "",
          traceId: selected.metadata?.trace_id || "",
          idempotencyKey: window.crypto?.randomUUID?.() || `${selected.id}-${Date.now()}`
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Review action failed");
      setReviewActionState(payload.replayed ? "Action already recorded." : "Review action recorded.");
      setReviewAction("");
      setReviewRationale("");
      setReviewCorrection("");
      await loadReviewItems();
    } catch (error) {
      setReviewActionState(error.message);
    }
  };

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

      <Panel title="Dataset run publication" eyebrow="Dataset Insight Graph" pill="Review required">
        {datasetRuns.length ? <>
          <div className="review-toolbar">
            <label>Dataset run<select value={selectedDatasetRun} onChange={(event) => setSelectedDatasetRun(event.target.value)}>
              {datasetRuns.map((item) => <option key={item.batchId} value={item.batchId}>{item.sourceType} · {item.version || item.batchId}</option>)}
            </select></label>
            <label>Decision<select value={datasetReviewStatus} onChange={(event) => setDatasetReviewStatus(event.target.value)}>
              {['approved', 'corrected', 'rejected', 'withdrawn', 'reanalyse'].map((value) => <option key={value} value={value}>{value}</option>)}
            </select></label>
          </div>
          <textarea value={datasetReviewNote} onChange={(event) => setDatasetReviewNote(event.target.value)} placeholder="Review basis" rows={2} />
          <button className="primary-button" type="button" onClick={submitDatasetReview} disabled={!selectedDatasetRun || datasetReviewState === "saving"}>{datasetReviewState === "saving" ? "Saving..." : "Record dataset decision"}</button>
          {datasetReviewState && datasetReviewState !== "saving" ? <p role="status">Snapshot state: {datasetReviewState}</p> : null}
          {datasetReviewError ? <p role="alert">{datasetReviewError}</p> : null}
        </> : <p>No published dataset runs are available for review.</p>}
      </Panel>

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
                <p><strong>Graph run:</strong> {selected.metadata?.graph_run_id || "Not linked"}</p>
                <p><strong>Trace:</strong> {selected.metadata?.trace_id || "Not linked"}</p>
                <BulletList items={(selected.evidence_chain || []).map((step) => step)} />
                {!String(selected.id).startsWith("seed-") ? <div className="review-action-form">
                  <label>Action<select value={reviewAction} onChange={(event) => setReviewAction(event.target.value)}>
                    <option value="">Select an action</option>
                    <option value="approve">Approve and publish</option>
                    <option value="correct">Correct</option>
                    <option value="reject">Reject</option>
                    <option value="withdraw">Withdraw</option>
                    <option value="request_reanalysis">Request re-analysis</option>
                  </select></label>
                  <label>Basis<textarea value={reviewRationale} onChange={(event) => setReviewRationale(event.target.value)} rows={3} placeholder="Why is this action justified?" /></label>
                  {reviewAction === "correct" ? <label>Correction<textarea value={reviewCorrection} onChange={(event) => setReviewCorrection(event.target.value)} rows={3} placeholder="Describe the required correction" /></label> : null}
                  <button className="primary-button" type="button" disabled={!reviewAction || !reviewRationale.trim() || (reviewAction === "correct" && !reviewCorrection.trim()) || reviewActionState === "saving"} onClick={submitReviewAction}>{reviewActionState === "saving" ? "Recording..." : "Record action"}</button>
                  {reviewActionState && reviewActionState !== "saving" ? <p role="status">{reviewActionState}</p> : null}
                </div> : <p>Seed items are read-only until a database-backed graph run is available.</p>}
                {(selected.action_history || []).length ? <div className="review-action-history"><h4>Action history</h4><BulletList items={selected.action_history.map((action) => `${action.createdAt || action.created_at || ""}: ${action.actor || action.actor_name || "Reviewer"} ${action.action || action.action_type || "acted"} (${action.previousStatus || action.previous_status || "draft"} to ${action.nextStatus || action.next_status || ""})`)} /></div> : null}
                <div className="review-actions">
                  {(selected.artifacts || []).map((artifact) => (
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

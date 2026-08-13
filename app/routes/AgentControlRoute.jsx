import React, { useEffect, useState } from "react";
import { DataTable, MetricCard, Panel } from "../components/common.jsx";
import { getAccessToken } from "../lib/auth.js";

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(Number(value || 0));
}

function formatTimestamp(value) {
  if (!value) return "No activity";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AgentControlRoute() {
  const [observability, setObservability] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [evaluationRuns, setEvaluationRuns] = useState([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);
  const [evaluationState, setEvaluationState] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const headers = { Authorization: `Bearer ${getAccessToken()}` };
    Promise.all([
      fetch("/api/admin/observability", { headers }),
      fetch("/api/admin/conversations?limit=12", { headers }),
      fetch("/api/admin/evaluations", { headers })
    ])
      .then(async ([metricsResponse, conversationsResponse, evaluationsResponse]) => {
        if (!metricsResponse.ok || !conversationsResponse.ok || !evaluationsResponse.ok) {
          const rejected = !metricsResponse.ok ? metricsResponse : !conversationsResponse.ok ? conversationsResponse : evaluationsResponse;
          const payload = await rejected.json().catch(() => ({}));
          throw new Error(payload.error || "Unable to load administrator monitoring");
        }
        const [metrics, messages, evaluations] = await Promise.all([metricsResponse.json(), conversationsResponse.json(), evaluationsResponse.json()]);
        setObservability(metrics);
        setConversations(messages.conversations || []);
        setEvaluationRuns(evaluations.runs || []);
      })
      .catch((cause) => setError(cause.message));
  }, []);

  const runEvaluation = async () => {
    setEvaluationState("running");
    try {
      const response = await fetch("/api/admin/evaluations", { method: "POST", headers: { Authorization: `Bearer ${getAccessToken()}`, "Content-Type": "application/json" }, body: "{}" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Evaluation failed");
      setEvaluationRuns((runs) => [payload, ...runs]);
      setEvaluationState("completed");
    } catch (cause) {
      setEvaluationState(cause.message);
    }
  };

  const openEvaluation = async (runId) => {
    try {
      const response = await fetch(`/api/admin/evaluations/${encodeURIComponent(runId)}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load evaluation details");
      setSelectedEvaluation(payload);
    } catch (cause) {
      setError(cause.message);
    }
  };

  if (error) {
    return <section className="agent-control"><div className="agent-control-empty"><p className="eyebrow">Administrator workspace</p><h2>Monitoring unavailable</h2><p>{error}</p></div></section>;
  }

  const tokens = observability?.tokens || {};
  const users = observability?.users || [];
  const layers = observability?.layers || [];
  const routeMonitoring = observability?.routeMonitoring || [];

  return <section className="agent-control">
    <header className="agent-control-header">
      <div><p className="eyebrow">Administrator workspace</p><h2>Agent Control</h2><p>Live monitoring for retrieval activity, model usage, and recent operator conversations.</p></div>
      <a className="agent-control-exit" href="/it-data-flow">Open project workspace</a>
    </header>

    <div className="agent-control-metrics" aria-label="24-hour monitoring summary">
      <MetricCard label="Requests (24h)" value={formatNumber(tokens.requests)} detail={`${formatNumber(observability?.demo?.events)} demo route events included`} />
      <MetricCard label="Total tokens" value={formatNumber(tokens.total)} detail={`${formatNumber(tokens.input)} input / ${formatNumber(tokens.output)} output`} />
      <MetricCard label="Active accounts" value={formatNumber(users.filter((user) => Number(user.requests) > 0).length)} detail="Accounts with recorded activity" />
    </div>

    <div className="agent-control-grid">
      <Panel title="Route monitoring" eyebrow="Simulated agent activity" pill="4 routes · 150 events">
        <DataTable columns={["route_name", "requests", "total_tokens", "avg_latency_ms", "records", "last_seen_at"]} rows={routeMonitoring.map((route) => ({
          route_name: route.route_name,
          requests: formatNumber(route.requests),
          total_tokens: formatNumber(route.total_tokens),
          avg_latency_ms: `${Number(route.avg_latency_ms || 0).toFixed(1)} ms`,
          records: formatNumber(route.records),
          last_seen_at: formatTimestamp(route.last_seen_at)
        }))} />
      </Panel>
      <Panel title="Retrieval layers" eyebrow="Pipeline health" pill="Last 24 hours">
        <DataTable columns={["name", "requests", "latency_ms", "records"]} rows={layers.map((layer) => ({
          name: layer.name,
          requests: formatNumber(layer.requests),
          latency_ms: `${formatNumber(layer.latency_ms)} ms`,
          records: formatNumber(layer.records)
        }))} />
      </Panel>
      <Panel title="Account activity" eyebrow="Usage by account" pill="Last 24 hours">
        <DataTable columns={["username", "requests", "total_tokens", "last_seen_at"]} rows={users.map((user) => ({
          username: user.username,
          requests: formatNumber(user.requests),
          total_tokens: formatNumber(user.total_tokens),
          last_seen_at: formatTimestamp(user.last_seen_at)
        }))} />
      </Panel>
    </div>

    <Panel title="Evaluation runs" eyebrow="Promotion gate" pill={evaluationState === "running" ? "Running" : "Frozen set"}>
      <div className="agent-evaluation-action"><button type="button" onClick={runEvaluation} disabled={evaluationState === "running"}>{evaluationState === "running" ? "Running evaluation" : "Run frozen evaluation"}</button><span>{evaluationState !== "idle" && evaluationState !== "running" ? evaluationState : ""}</span></div>
      <DataTable columns={["evaluation_set_version", "promotion_state", "recall_at_5", "citation_correctness", "p95_latency_ms", "details"]} rows={evaluationRuns.map((run) => ({
        evaluation_set_version: run.evaluation_set_version || run.evaluationSetVersion || "-",
        promotion_state: run.promotion_state || run.promotionState || run.status || "-",
        recall_at_5: Number(run.metrics?.recall_at_5 || 0).toFixed(3),
        citation_correctness: Number(run.metrics?.citation_correctness || 0).toFixed(3),
        p95_latency_ms: `${formatNumber(run.metrics?.p95_latency_ms)} ms`,
        details: <button type="button" onClick={() => openEvaluation(run.id)}>Open</button>
      }))} />
      {selectedEvaluation && <div className="agent-evaluation-detail">
        <div className="agent-evaluation-detail-header"><strong>Run {selectedEvaluation.run?.id}</strong><button type="button" onClick={() => setSelectedEvaluation(null)}>Close</button></div>
        <p>Trace: {selectedEvaluation.trace?.traceId || "-"} · Graph: {selectedEvaluation.trace?.graphVersion || "-"}</p>
        <DataTable columns={["case_key", "judge_score", "citation_correct", "latency_ms", "failed", "human_overall_score"]} rows={(selectedEvaluation.caseResults || []).map((item) => ({
          case_key: item.case_key,
          judge_score: item.judge_score == null ? "-" : Number(item.judge_score).toFixed(3),
          citation_correct: item.citation_correct == null ? "-" : String(item.citation_correct),
          latency_ms: formatNumber(item.latency_ms),
          failed: String(Boolean(item.failed)),
          human_overall_score: item.human_overall_score == null ? "-" : Number(item.human_overall_score).toFixed(3)
        }))} />
      </div>}
    </Panel>

    <Panel title="Recent conversations" eyebrow="Audit trail" pill="Latest 12">
      <div className="agent-conversations">
        {conversations.length ? conversations.map((conversation, index) => <article key={`${conversation.sessionId}-${conversation.createdAt}-${index}`}>
          <div><strong>{conversation.username || "Unknown account"}</strong><span>{conversation.routeKey || "all"} · {conversation.role} · {formatTimestamp(conversation.createdAt)}</span></div>
          <p>{conversation.message}</p>
        </article>) : <p className="panel-note">No conversation activity has been recorded yet.</p>}
      </div>
    </Panel>
  </section>;
}

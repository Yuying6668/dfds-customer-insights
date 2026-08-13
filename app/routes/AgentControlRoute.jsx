import React, { useEffect, useState } from "react";
import { DataTable, MetricCard, Panel } from "../components/common.jsx";
import { getAccessToken } from "../lib/auth.js";
import { agentHandoffMotion, monitoringMotion } from "../lib/agent-monitoring-motion.mjs";

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(Number(value || 0));
}

function formatTimestamp(value) {
  if (!value) return "No activity";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function AgentDataFlow({ observability }) {
  const requests = Number(observability?.tokens?.requests || 0);
  const totalTokens = Number(observability?.tokens?.total || 0);
  const ragRecords = (observability?.layers || []).reduce((sum, layer) => sum + Number(layer.records || 0), 0);
  const demoEvents = Number(observability?.demo?.events || 0);
  const routeCount = Number(observability?.routeMonitoring?.length || 0);
  const flowMotion = monitoringMotion({ requests: demoEvents || requests, avg_latency_ms: 190, records: ragRecords });
  const nodes = [
    { key: "users", label: "Real users", detail: "Questions · feedback · tasks", state: "active" },
    { key: "gateway", label: "Data gateway", detail: "Masking · route detection", state: "secure" },
    { key: "retrieval", label: "RAG retrieval", detail: "Keyword · semantic · rerank", state: "retrieving" },
    { key: "agent", label: "Mia Agent", detail: "Answer · citations · review", state: "thinking" },
    { key: "routes", label: "Route monitoring", detail: `${routeCount} routes · ${formatNumber(demoEvents)} events`, state: "streaming" }
  ];
  return <div className="agent-flow" aria-label="Agent data transmission flow" style={{ "--flow-seconds": `${flowMotion.packetSeconds}s`, "--rag-seconds": `${flowMotion.ragSeconds}s`, "--agent-load": `${Math.min(1, totalTokens / 150000)}` }}>
    <div className="agent-flow-track" aria-hidden="true"><span /><span /><span /><span /></div>
    {nodes.map((node, index) => <div className="agent-flow-node" key={node.key}>
      <div className={`agent-flow-icon ${node.state}`}><span>{String(index + 1).padStart(2, "0")}</span><i /></div>
      <strong>{node.label}</strong>
      <small>{node.detail}</small>
      <em>{node.state === "retrieving" ? "retrieving" : node.state === "thinking" ? "reasoning" : "connected"}</em>
    </div>)}
    <div className="agent-rag-lane" aria-label="RAG retrieval stages">
      <span className="agent-rag-label">RAG trace</span>
      <span className="agent-rag-step"><i />Keyword</span><b /><span className="agent-rag-step"><i />Semantic</span><b /><span className="agent-rag-step"><i />Rerank</span>
    </div>
  </div>;
}

function ConnectionMonitor({ routes }) {
  return <div className="connection-monitor" aria-label="Route connection monitor">
    {routes.map((route, index) => {
      const latency = Number(route.avg_latency_ms || 0);
      const motion = monitoringMotion(route);
      const tone = motion.tone;
      return <article className={`connection-card ${tone}`} key={route.route_key} style={{ "--connection-delay": `${index * 0.38}s`, "--packet-count": motion.packets, "--packet-seconds": `${motion.packetSeconds}s`, "--rag-seconds": `${motion.ragSeconds}s` }}>
        <div className="connection-card-heading"><span className="connection-status"><i />{tone === "warn" ? "Elevated" : "Healthy"}</span><strong>{route.route_name}</strong></div>
        <div className="connection-line">{Array.from({ length: motion.packets }, (_, packet) => <span className={`connection-packet packet-${packet + 1}`} key={packet} />)}</div>
        <div className="connection-card-meta"><span>{latency.toFixed(1)} ms avg</span><span>{formatNumber(route.requests)} events</span></div>
      </article>;
    })}
  </div>;
}

function AgentHandoffMonitor({ observability, routes }) {
  const motion = agentHandoffMotion({
    requests: observability?.demo?.events || observability?.tokens?.requests,
    totalTokens: observability?.tokens?.total,
    routeCount: routes.length
  });
  const agents = ["Mia Agent", "Route Agent", "Review Agent", "Operations Agent"];
  return <div className="agent-handoff" aria-label="Agent to agent monitoring flow" style={{ "--handoff-seconds": `${motion.handoffSeconds}s`, "--agent-pulse-seconds": `${motion.agentPulseSeconds}s` }}>
    <div className="agent-handoff-header"><span>Agent-to-Agent monitoring</span><strong>{formatNumber(observability?.demo?.events || observability?.tokens?.requests)} routed handoffs</strong></div>
    <div className="agent-handoff-network">
      <div className="agent-handoff-forward">{Array.from({ length: motion.forwardPackets }, (_, index) => <i key={`forward-${index}`} style={{ "--handoff-delay": `${index * motion.handoffSeconds / motion.forwardPackets}s` }} />)}</div>
      <div className="agent-handoff-return">{Array.from({ length: motion.returnPackets }, (_, index) => <i key={`return-${index}`} style={{ "--handoff-delay": `${index * motion.handoffSeconds / motion.returnPackets + .3}s` }} />)}</div>
      {agents.map((agent, index) => <article className="agent-handoff-node" key={agent}><span>{String(index + 1).padStart(2, "0")}</span><strong>{agent}</strong><small>{index === 0 ? "orchestrates" : index === 1 ? "route context" : index === 2 ? "policy check" : "operational output"}</small></article>)}
    </div>
  </div>;
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
      <div className="agent-control-header-actions"><span className="agent-live-indicator"><i />Live demo stream</span><a className="agent-control-exit" href="/it-data-flow">Open project workspace</a></div>
    </header>

    <Panel title="Agent data transmission" eyebrow="Live simulation" pill="Streaming">
      <AgentDataFlow observability={observability} />
      <AgentHandoffMonitor observability={observability} routes={routeMonitoring} />
    </Panel>

    <div className="agent-control-metrics" aria-label="24-hour monitoring summary">
      <MetricCard label="Requests (24h)" value={formatNumber(tokens.requests)} detail={`${formatNumber(observability?.demo?.events)} demo route events included`} />
      <MetricCard label="Total tokens" value={formatNumber(tokens.total)} detail={`${formatNumber(tokens.input)} input / ${formatNumber(tokens.output)} output`} />
      <MetricCard label="Active accounts" value={formatNumber(users.filter((user) => Number(user.requests) > 0).length)} detail="Accounts with recorded activity" />
    </div>

    <div className="agent-control-grid">
      <Panel title="Route monitoring" eyebrow="Simulated agent activity" pill={`${routeMonitoring.length} routes · ${formatNumber(observability?.demo?.events)} events`}>
        <ConnectionMonitor routes={routeMonitoring} />
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

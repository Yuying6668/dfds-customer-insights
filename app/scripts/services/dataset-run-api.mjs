import { getAccessToken } from "../../lib/auth.js";

export async function publishDatasetRun(batchId) {
  const response = await fetch(`/api/upload-batches/${encodeURIComponent(batchId)}/publish`, { method: "POST", headers: { Authorization: `Bearer ${getAccessToken()}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Dataset could not be published");
  return payload;
}

export async function getDatasetRunAnalytics(batchId) {
  const response = await fetch(`/api/upload-batches/${encodeURIComponent(batchId)}/analytics`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  const payload = await response.json();
  if (!response.ok && response.status !== 202) throw new Error(payload.error || "Dataset analytics could not be loaded");
  return payload;
}

export async function retryDatasetRun(batchId) {
  const response = await fetch(`/api/upload-batches/${encodeURIComponent(batchId)}/analysis/retry`, { method: "POST", headers: { Authorization: `Bearer ${getAccessToken()}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Dataset analysis could not be retried");
  return payload;
}

export async function compareDatasetRuns(batchId, baselineId) {
  const response = await fetch(`/api/upload-batches/${encodeURIComponent(batchId)}/compare?baseline=${encodeURIComponent(baselineId)}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Dataset versions could not be compared");
  return payload;
}

export async function listDatasetRuns() {
  const response = await fetch("/api/upload-batches", { headers: { Authorization: `Bearer ${getAccessToken()}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Dataset runs could not be loaded");
  return payload.runs || [];
}

export function subscribeDatasetRun(batchId, onStatus) {
  const source = new EventSource(`/api/upload-batches/${encodeURIComponent(batchId)}/events?access_token=${encodeURIComponent(getAccessToken() || "")}`);
  source.addEventListener("dataset-run-status", (event) => onStatus(JSON.parse(event.data)));
  return () => source.close();
}

import { getAccessToken } from "../../lib/auth.js";

async function datasetRunRequest(url, { accessToken = getAccessToken(), fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Dataset could not be updated");
  return payload;
}

export async function activateDatasetRun(batchId, options = {}) {
  const encodedBatchId = encodeURIComponent(batchId);
  const batch = await datasetRunRequest(`/api/upload-batches/${encodedBatchId}/save-cleaned`, options);
  const published = await datasetRunRequest(`/api/upload-batches/${encodedBatchId}/publish`, options);
  return { batch: batch.batch, run: published.run, analysisState: published.analysisState };
}

export async function publishDatasetRun(batchId) {
  return datasetRunRequest(`/api/upload-batches/${encodeURIComponent(batchId)}/publish`);
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

export async function reviewDatasetRun(batchId, decision) {
  const response = await fetch(`/api/upload-batches/${encodeURIComponent(batchId)}/analysis/review`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAccessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(decision)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Dataset review could not be saved");
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

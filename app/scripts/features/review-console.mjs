import { reviewConsoleSeedItems } from "../../data/review-console.mjs";
import { $ } from "../core/dom.mjs";

const labels = {
  all: "All signals",
  approved: "Approved",
  collection: "Collection",
  high: "High",
  internal_only: "Internal only",
  language: "Language",
  medium: "Medium",
  needs_changes: "Needs changes",
  pending: "Pending",
  rejected: "Rejected",
  release: "Release",
  retrieval: "Retrieval",
  scope: "Scope",
  verified: "Verified"
};

let reviewItems = reviewConsoleSeedItems;
let selectedId = reviewItems[0]?.id || "";
let eventsBound = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function label(value) {
  return labels[value] || String(value || "Unknown").replaceAll("_", " ");
}

function optionValues(key) {
  return [...new Set(reviewItems.map((item) => item[key]).filter(Boolean))].sort();
}

function currentFilters() {
  return {
    layer: $("#reviewLayerFilter")?.value || "",
    q: $("#reviewSearch")?.value.trim().toLowerCase() || "",
    severity: $("#reviewSeverityFilter")?.value || "",
    status: $("#reviewStatusFilter")?.value || ""
  };
}

function filteredItems() {
  const filters = currentFilters();
  return reviewItems.filter((item) => {
    const haystack = `${item.title} ${item.reason} ${item.recommendation}`.toLowerCase();
    return (!filters.q || haystack.includes(filters.q)) &&
      (!filters.layer || item.layer === filters.layer) &&
      (!filters.status || item.status === filters.status) &&
      (!filters.severity || item.severity === filters.severity);
  });
}

function renderFilterOptions() {
  const renderOptions = (placeholder, values) => [
    `<option value="">${placeholder}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(label(value))}</option>`)
  ].join("");

  $("#reviewLayerFilter").innerHTML = renderOptions("All layers", optionValues("layer"));
  $("#reviewStatusFilter").innerHTML = renderOptions("All statuses", optionValues("status"));
  $("#reviewSeverityFilter").innerHTML = renderOptions("All severities", optionValues("severity"));
}

function statusClass(value) {
  return `status-${String(value || "unknown").replaceAll("_", "-")}`;
}

function severityClass(value) {
  return `severity-${String(value || "unknown").replaceAll("_", "-")}`;
}

function renderQueue() {
  const items = filteredItems();
  if (!items.some((item) => String(item.id) === String(selectedId))) {
    selectedId = items[0]?.id || "";
  }

  $("#reviewQueue").innerHTML = items.map((item) => `
    <button class="review-row ${String(item.id) === String(selectedId) ? "active" : ""}" data-review-id="${escapeHtml(item.id)}">
      <span class="review-row-title">${escapeHtml(item.title)}</span>
      <span class="review-row-meta">${escapeHtml(label(item.layer))} · ${escapeHtml(label(item.route_key))}</span>
      <span class="review-row-badges">
        <span class="review-badge ${statusClass(item.status)}">${escapeHtml(label(item.status))}</span>
        <span class="review-badge ${severityClass(item.severity)}">${escapeHtml(label(item.severity))}</span>
      </span>
    </button>
  `).join("") || `<div class="review-empty">No review items match the current filters.</div>`;
}

function selectedItem() {
  const items = filteredItems();
  return items.find((candidate) => String(candidate.id) === String(selectedId)) || items[0] || null;
}

function renderDetail() {
  const item = selectedItem();
  if (!item) {
    $("#reviewDetail").innerHTML = `<div class="review-empty">The console is waiting for the first validated run.</div>`;
    $("#reviewEvidenceChain").innerHTML = "";
    return;
  }

  selectedId = item.id;
  $("#reviewDetail").innerHTML = `
    <div class="review-detail-header">
      <div>
        <p class="eyebrow">${escapeHtml(label(item.layer))} review</p>
        <h3>${escapeHtml(item.title)}</h3>
      </div>
      <span class="review-badge ${statusClass(item.status)}">${escapeHtml(label(item.status))}</span>
    </div>
    <dl class="review-fields">
      <div><dt>Reason</dt><dd>${escapeHtml(item.reason)}</dd></div>
      <div><dt>Recommendation</dt><dd>${escapeHtml(item.recommendation)}</dd></div>
      <div><dt>Source</dt><dd>${escapeHtml(item.source || item.source_key || "Internal review")}</dd></div>
      <div><dt>Publish state</dt><dd>${escapeHtml(label(item.publish_state))}</dd></div>
    </dl>
    <div class="review-actions" aria-label="Review actions">
      <button class="secondary-button" data-review-status="approved">Approve</button>
      <button class="secondary-button" data-review-status="needs_changes">Needs changes</button>
      <button class="secondary-button" data-review-status="rejected">Reject</button>
    </div>
  `;

  $("#reviewEvidenceChain").innerHTML = `
    <h3>Evidence chain</h3>
    <ol>${(item.evidence_chain || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
    <h3>Artifacts</h3>
    <ul>${(item.artifacts || []).map((path) => `<li><code>${escapeHtml(path)}</code></li>`).join("")}</ul>
  `;
}

function renderConsole() {
  renderQueue();
  renderDetail();
}

async function loadReviewItems() {
  try {
    const response = await fetch("/api/review-items");
    if (!response.ok) {
      throw new Error(`Review API returned ${response.status}`);
    }
    const payload = await response.json();
    reviewItems = payload.items?.length
      ? payload.items.map((item) => ({ id: item.id || item.review_key, ...item }))
      : reviewConsoleSeedItems;
  } catch {
    reviewItems = reviewConsoleSeedItems;
  }
  selectedId = reviewItems[0]?.id || "";
}

function bindReviewConsoleEvents() {
  if (eventsBound) return;
  eventsBound = true;

  ["reviewSearch", "reviewLayerFilter", "reviewStatusFilter", "reviewSeverityFilter"].forEach((id) => {
    $(`#${id}`)?.addEventListener("input", renderConsole);
  });

  $("#reviewQueue")?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-review-id]");
    if (!row) return;
    selectedId = row.dataset.reviewId;
    renderConsole();
  });

  $("#reviewDetail")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-review-status]");
    if (!button) return;
    const item = reviewItems.find((candidate) => String(candidate.id) === String(selectedId));
    if (!item) return;
    const nextStatus = button.dataset.reviewStatus;
    item.status = nextStatus;
    if (!String(item.id).startsWith("seed-")) {
      try {
        await fetch(`/api/review-items/${item.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus })
        });
      } catch {
        item.status = "needs_changes";
      }
    }
    renderFilterOptions();
    renderConsole();
  });
}

export async function renderReviewConsole() {
  if (!$("#reviewConsole")) return;
  await loadReviewItems();
  renderFilterOptions();
  renderConsole();
  bindReviewConsoleEvents();
}

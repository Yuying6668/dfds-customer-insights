import { dfdsIntelligenceData as data } from "../../data/index.mjs";
import { $ } from "../core/dom.mjs";

export function getVisibleRecommendations(route = "all") {
  return data.recommendations.filter((item) => !item.routes || item.routes.includes(route) || route === "all");
}

export function renderRecommendations(route = "all") {
  const summary = $("#recommendationSummary");
  const priorityMap = $("#priorityMap");
  const list = $("#recommendationList");
  const visibleRecommendations = getVisibleRecommendations(route);
  const routeName = data.routeInsights[route]?.title || "All signals";
  const highCount = visibleRecommendations.filter((item) => item.priority === "High").length;
  const mediumCount = visibleRecommendations.filter((item) => item.priority === "Medium").length;

  summary.innerHTML = `
    <article>
      <span>Route focus</span>
      <strong>${routeName}</strong>
    </article>
    <article>
      <span>Actions</span>
      <strong>${visibleRecommendations.length} recommended actions</strong>
    </article>
    <article>
      <span>Urgency</span>
      <strong>${highCount} do first / ${mediumCount} do next</strong>
    </article>
  `;

  const priorityGroups = ["High", "Medium"].map((priority) => {
    const items = visibleRecommendations.filter((item) => item.priority === priority);
    const label = priority === "High" ? "Do first" : "Do next";
    return `
      <article class="priority-lane ${priority.toLowerCase()}-priority">
        <div class="item-top">
          <h4>${label}</h4>
          <span class="pill ${priority.toLowerCase()}">${items.length} actions</span>
        </div>
        <div class="priority-chips">
          ${items.map((item) => `<span>${item.title}</span>`).join("") || "<span>No actions for this route</span>"}
        </div>
      </article>
    `;
  }).join("");

  priorityMap.innerHTML = priorityGroups;

  list.innerHTML = visibleRecommendations
    .map(
      (item) => `
        <article class="recommendation-item ${item.priority.toLowerCase()}-priority">
          <div class="item-top">
            <h4>${item.title}</h4>
            <span class="pill ${item.priority.toLowerCase()}">${item.priority}</span>
          </div>
          <div class="action-strip">
            <div>
              <span>Expected result</span>
              <strong>${item.expectedImprovement}</strong>
            </div>
            <div>
              <span>Based on</span>
              <strong>${item.evidence || "Customer voice themes"}</strong>
            </div>
          </div>
          <details class="evidence-details">
            <summary>Reason</summary>
            <p>${item.reasoning}</p>
          </details>
        </article>
      `
    )
    .join("");
}

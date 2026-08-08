import { dfdsIntelligenceData as data } from "../../data/index.mjs";
import { $ } from "../core/dom.mjs";
import { parseRating, parseReviewCount } from "../utils/format.mjs";

export function renderStandardization() {
  const grid = $("#standardizationGrid");
  grid.innerHTML = data.standardization
    .map(
      (item) => `
        <article class="standard-item">
          <span>${item.label}</span>
          <b>${item.value}</b>
          <span>${item.detail}</span>
        </article>
      `
    )
    .join("");
}

export function renderSentimentBars() {
  const list = $("#sentimentBars");
  const segments = data.sentimentMix
    .map(
      (item) => `
        <span
          class="temperature-segment"
          style="width: ${item.value}%; background: ${item.color}"
          title="${item.label}: ${item.value}%"
        ></span>
      `
    )
    .join("");

  list.innerHTML = `
    <div class="temperature-bar">${segments}</div>
    <div class="temperature-legend">
      ${data.sentimentMix
        .map(
          (item) => `
            <div>
              <span class="legend-dot" style="background:${item.color}"></span>
              <strong>${item.label}</strong>
              <em>${item.value}%</em>
              <small>${item.note}</small>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

export function renderCoverage() {
  const grid = $("#coverageGrid");
  grid.innerHTML = data.sourceCoverage
    .map(
      (source) => `
        <article class="coverage-item">
          <div class="item-top">
            <h4>
              ${
                source.logo
                  ? `<img class="coverage-logo" src="${source.logo}" alt="${source.source} logo" />`
                  : `<span class="file-logo">CSV</span>`
              }
              ${source.source}
            </h4>
            <span class="pill">${source.status}</span>
          </div>
          <p><strong>${source.records}</strong></p>
          <p>${source.insight}</p>
        </article>
      `
    )
    .join("");
}

export function renderRouteLens(route = "all") {
  const insight = data.routeInsights[route] || data.routeInsights.all;
  $("#routeTitle").textContent = insight.title;
  $("#routeStatus").textContent = insight.status;
  $("#routeLens").innerHTML = `
    <article>
      <span>Why selected</span>
      <strong>${insight.reason}</strong>
    </article>
    <article>
      <span>Main risk</span>
      <strong>${insight.risk}</strong>
    </article>
    <article>
      <span>Next action</span>
      <strong>${insight.action}</strong>
    </article>
  `;
}

export function renderLocationChart() {
  const chart = $("#locationChart");
  const maxReviews = Math.max(...data.googleReviewLocations.map((location) => parseReviewCount(location.reviews) || 0));

  chart.innerHTML = data.googleReviewLocations
    .map((location) => {
      const rating = parseRating(location.rating) || 0;
      const reviews = parseReviewCount(location.reviews) || 0;
      const ratingWidth = `${Math.round((rating / 5) * 100)}%`;
      const reviewWidth = `${Math.max(8, Math.round((reviews / maxReviews) * 100))}%`;

      return `
        <article class="location-row">
          <div>
            <h4>${location.name}</h4>
            <p>${data.routeInsights[location.route]?.title || location.route}</p>
          </div>
          <div class="location-bars">
            <div>
              <span>Rating</span>
              <div class="mini-track"><i style="width:${ratingWidth}"></i></div>
              <strong>${location.rating}</strong>
            </div>
            <div>
              <span>Review volume</span>
              <div class="mini-track muted"><i style="width:${reviewWidth}"></i></div>
              <strong>${location.reviews}</strong>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

export function renderRootCauses() {
  const list = $("#rootCauseList");
  list.innerHTML = data.rootCauses
    .map(
      (item) => `
        <article class="root-item">
          <div class="item-top">
            <h4>${item.title}</h4>
            <span class="pill ${item.impact.toLowerCase()}">${item.impact} impact</span>
          </div>
          <p>${item.summary}</p>
        </article>
      `
    )
    .join("");
}

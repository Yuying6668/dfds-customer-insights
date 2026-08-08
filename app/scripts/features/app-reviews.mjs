import { dfdsIntelligenceData as data } from "../../data/index.mjs";
import { $ } from "../core/dom.mjs";

export function renderAppReviews() {
  const grid = $("#appReviewGrid");
  const storeCards = data.appStores
    .map(
      (store) => `
        <article class="app-store-card">
          <div class="item-top">
            <div>
              <h4><img class="store-logo" src="${store.logo}" alt="${store.platform} logo" />${store.platform}</h4>
              <p>${store.app} · ${store.package}</p>
            </div>
            <span class="pill">${store.status}</span>
          </div>
          <div class="app-score">
            <strong>${store.rating}</strong>
            <span>${store.reviewCount}</span>
          </div>
          <p>${store.summary}</p>
          <a href="${store.url}" target="_blank" rel="noreferrer">Open ${store.platform}</a>
        </article>
      `
    )
    .join("");

  const evidenceCards = data.appReviewEvidence
    .map(
      (review) => `
        <article class="app-evidence-card">
          <div class="item-top">
            <div>
              <h4>${review.title}</h4>
              <p>${review.platform} · ${review.date} · ${review.rating}</p>
            </div>
            <span class="pill ${review.rating.startsWith("1") ? "high" : ""}">${review.theme}</span>
          </div>
          <p><strong>Evidence:</strong> ${review.evidence}</p>
          <p><strong>Business meaning:</strong> ${review.businessMeaning}</p>
        </article>
      `
    )
    .join("");

  grid.innerHTML = `
    <div class="store-grid">${storeCards}</div>
    <div class="evidence-stack">${evidenceCards}</div>
  `;
}

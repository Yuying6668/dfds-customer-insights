import { dfdsIntelligenceData as data } from "../../data/index.mjs";
import { $ } from "../core/dom.mjs";

export function getVoiceThemes(route = "all") {
  return data.voiceThemes.filter((theme) => (route === "all" ? theme.routes.includes("all") : theme.routes.includes(route)));
}

export function renderSignals(route = "all") {
  const summary = $("#voiceSummary");
  const list = $("#themeList");
  const visibleThemes = getVoiceThemes(route);
  const routeName = data.routeInsights[route]?.title || "All signals";
  $("#signalTitle").textContent = route === "all" ? "What customers are telling DFDS" : `${routeName} customer voice`;
  $("#signalScope").textContent = route === "all" ? "All signals" : "Selected route only";

  const sourceCount = new Set(visibleThemes.flatMap((theme) => theme.sources)).size;
  const positiveCount = visibleThemes.filter((theme) => theme.sentiment.includes("Positive")).length;
  const negativeCount = visibleThemes.filter((theme) => theme.sentiment.includes("Negative")).length;

  summary.innerHTML = `
    <article>
      <span>Purpose</span>
      <strong>Turn public feedback into marketing themes.</strong>
    </article>
    <article>
      <span>Themes</span>
      <strong>${visibleThemes.length} themes for ${routeName}.</strong>
    </article>
    <article>
      <span>Sources</span>
      <strong>${sourceCount} source types included.</strong>
    </article>
    <article>
      <span>Signal balance</span>
      <strong>${positiveCount} positive / ${negativeCount} risk themes.</strong>
    </article>
  `;

  list.innerHTML = visibleThemes.length
    ? visibleThemes
      .map(
        (theme) => `
          <article class="theme-card">
            <div class="item-top">
              <div>
                <h4>${theme.theme}</h4>
                <p>${theme.routeLabel}</p>
              </div>
              <span class="pill ${theme.sentiment.includes("Negative") ? "high" : theme.sentiment.includes("Mixed") ? "medium" : ""}">${theme.sentiment}</span>
            </div>
            <div class="theme-grid">
              <div>
                <span>Sources</span>
                <strong>${theme.sources.join(", ")}</strong>
              </div>
              <div>
                <span>Customer meaning</span>
                <strong>${theme.customerMeaning}</strong>
              </div>
              <div>
                <span>Marketing action</span>
                <strong>${theme.marketingAction}</strong>
              </div>
            </div>
            <details class="evidence-details">
              <summary>View supporting evidence</summary>
              <ul>
                ${theme.evidence.map((item) => `<li>${item}</li>`).join("")}
              </ul>
            </details>
          </article>
        `
      )
      .join("")
    : `
      <article class="theme-card empty-state">
        <div class="item-top">
          <h4>No customer voice theme collected yet</h4>
          <span class="pill medium">Data gap</span>
        </div>
        <p>No public theme has been added for this route yet.</p>
      </article>
    `;
}

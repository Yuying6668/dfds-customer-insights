import { dfdsIntelligenceData as data } from "../../data/index.mjs";
import { $ } from "../core/dom.mjs";
import { getActiveView, getSelectedRoute } from "../core/state.mjs";
import { getVoiceThemes } from "./customer-voice.mjs";
import { numbered } from "../utils/format.mjs";

function makeOverviewBrief(route) {
  const routeInsight = data.routeInsights[route] || data.routeInsights.all;
  const googleProfiles = data.googleReviewLocations.map((location) => `${location.name}: ${location.rating}, ${location.reviews}`).join("; ");
  return [
    "DFDS Overview Brief",
    `Collected: ${data.collectedAt}`,
    "",
    "Topline:",
    "- DFDS has a strong overall Trustpilot score: 4.2/5 from 20,646 reviews.",
    "- The DFDS Passenger app is the clearest marketing watchout: Google Play is 2.5/5 and Apple App Store is 3.3/5 in the GB view.",
    `- Google Reviews have been added at location level: ${googleProfiles}.`,
    "- Main marketing risk: app friction may reduce customer confidence before the trip starts.",
    "",
    `Route focus: ${routeInsight.title}`,
    `- Main risk: ${routeInsight.risk}`,
    `- Suggested action: ${routeInsight.action}`
  ].join("\n");
}

function makeSignalsBrief(route) {
  const routeInsight = data.routeInsights[route] || data.routeInsights.all;
  const themes = getVoiceThemes(route);
  return [
    "DFDS Customer Voice Brief",
    `Route focus: ${routeInsight.title}`,
    `Collected: ${data.collectedAt}`,
    "",
    "Customer voice themes:",
    themes.length
      ? numbered(themes.map((theme) => `${theme.theme} (${theme.sentiment}) — ${theme.marketingAction}`))
      : "No public customer voice theme has been added for this route yet.",
    "",
    "Supporting sources:",
    themes.length
      ? numbered(themes.map((theme) => `${theme.theme}: ${theme.sources.join(", ")}`))
      : "No supporting sources available yet.",
    "",
    "Marketing use:",
    route === "all"
      ? "Use this view to understand the main cross-source customer themes before choosing a route-specific focus."
      : "Use this view to tailor route-level messaging, service recovery, and campaign claims."
  ].join("\n");
}

function makeAppReviewsBrief() {
  return [
    "DFDS App Reviews Brief",
    `Collected: ${data.collectedAt}`,
    "",
    "App store snapshot:",
    numbered(data.appStores.map((store) => `${store.platform}: ${store.rating}, ${store.reviewCount}. ${store.summary}`)),
    "",
    "Main customer issues:",
    numbered(data.appReviewEvidence.slice(0, 4).map((review) => `${review.theme}: ${review.businessMeaning}`)),
    "",
    "Marketing use:",
    "Treat app reliability as part of the pre-trip brand experience before promoting mobile self-service."
  ].join("\n");
}

function makeCompetitorsBrief() {
  const direct = data.competitors.filter((row) => row.category.includes("Same"));
  return [
    "DFDS Competitor Brief",
    `Collected: ${data.collectedAt}`,
    "",
    "Selection basis:",
    numbered(data.competitorScope.bullets),
    "",
    "Score availability:",
    "- All competitor rows now include a public review-score snapshot.",
    "- Newly filled scores come from Firecrawl search-result evidence for public Trustpilot profiles. Full Trustpilot page scraping may need periodic refresh because some pages show verification screens.",
    "",
    "Closest comparison set:",
    numbered(direct.map((row) => `${row.company}: ${row.overlap} Customer view: ${row.userView}`)),
    "",
    "Marketing use:",
    "Use this view to decide where DFDS should defend its position, borrow stronger competitor practices, or sharpen differentiation."
  ].join("\n");
}

function makeRecommendationsBrief(route) {
  const routeInsight = data.routeInsights[route] || data.routeInsights.all;
  const recs = data.recommendations.filter((item) => !item.routes || item.routes.includes(route) || route === "all");
  return [
    "DFDS Marketing Recommendations Brief",
    `Route focus: ${routeInsight.title}`,
    `Collected: ${data.collectedAt}`,
    "",
    "Recommended actions:",
    numbered(recs.map((rec) => `${rec.priority}: ${rec.title} — ${rec.expectedImprovement}`)),
    "",
    "Marketing use:",
    "Use this view to turn customer evidence into action priorities for messaging, journey communication, and campaign planning."
  ].join("\n");
}

function makeSurveyBrief() {
  return [
    "DFDS Survey CSV Brief",
    `Collected: ${data.collectedAt}`,
    "",
    "Current status:",
    "- No survey CSV has been uploaded yet.",
    "- Future survey data can add private customer segments, NPS/CSAT, route details, travel dates, and open-text feedback.",
    "",
    "Marketing use:",
    "Use survey data to validate whether public review signals also appear in owned customer feedback."
  ].join("\n");
}

function makeUpdateLogBrief() {
  return [
    "DFDS Update Log Brief",
    `Collected: ${data.collectedAt}`,
    "",
    "Recent dashboard changes:",
    numbered([...data.supervisorLogs].sort((a, b) => b.time.localeCompare(a.time)).map((log) => `${log.time} — ${log.change}. Reason: ${log.reason} Result: ${log.result}`)),
    "",
    "Marketing use:",
    "Use this view to see what changed in the dashboard, why it changed, and which page was affected."
  ].join("\n");
}

function makeDataBasisBrief() {
  return [
    "DFDS Data Basis Brief",
    `Collected: ${data.collectedAt}`,
    "",
    "Sources covered:",
    numbered(data.sourceCoverage.map((source) => `${source.source}: ${source.records}. Status: ${source.status}.`)),
    "",
    "Analysis scope:",
    "- This dashboard focuses on DFDS passenger ferry customers.",
    "- Freight and logistics customers are outside the current analysis scope.",
    "- Competitor data is interpreted in the passenger ferry context.",
    "",
    "Google Reviews location profiles:",
    numbered(data.googleReviewLocations.map((location) => `${location.name}: ${location.rating}, ${location.reviews}, mapped to ${data.routeInsights[location.route]?.title || location.route}.`)),
    "",
    "Preparation notes:",
    numbered(data.standardization.map((item) => `${item.label}: ${item.detail}`)),
    "",
    "Marketing use:",
    "Use this page to understand what evidence supports the dashboard and which data sources still need expansion."
  ].join("\n");
}

export function generateCurrentBrief() {
  const view = getActiveView();
  const route = getSelectedRoute();

  const generators = {
    overview: () => makeOverviewBrief(route),
    feedback: () => makeSignalsBrief(route),
    appreviews: makeAppReviewsBrief,
    benchmark: makeCompetitorsBrief,
    recommendations: () => makeRecommendationsBrief(route),
    surveys: makeSurveyBrief,
    supervisor: makeUpdateLogBrief,
    sources: makeDataBasisBrief
  };

  return (generators[view] || generators.overview)();
}

export function bindExport() {
  $("#exportButton").addEventListener("click", async () => {
    const brief = generateCurrentBrief();

    try {
      await navigator.clipboard.writeText(brief);
      $("#exportButton").textContent = "Brief copied";
      setTimeout(() => {
        $("#exportButton").textContent = "Export page brief";
      }, 1800);
    } catch {
      const blob = new Blob([brief], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "dfds-customer-intelligence-brief.txt";
      link.click();
      URL.revokeObjectURL(url);
    }
  });
}

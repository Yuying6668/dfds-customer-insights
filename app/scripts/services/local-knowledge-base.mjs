import { dfdsIntelligenceData as data } from "../../data/index.mjs";
import { normalizeSearchText, tokenizeQuery } from "../utils/format.mjs";

function addEvidenceItem(items, type, title, body, source, extra = {}) {
  if (!title && !body) return;
  items.push({
    id: `${type}-${items.length + 1}`,
    type,
    title,
    body,
    source,
    route: extra.route || "all",
    url: extra.url || "",
    scoreText: extra.scoreText || "",
    businessMeaning: extra.businessMeaning || ""
  });
}

export function buildLocalKnowledgeBase() {
  const items = [];

  data.sourceCoverage.forEach((source) => {
    addEvidenceItem(items, "Source coverage", source.source, `${source.records}. ${source.insight}`, source.source);
  });

  if (data.passengerProfileSummary) {
    const profile = data.passengerProfileSummary;
    addEvidenceItem(
      items,
      "Passenger profile source",
      profile.sourceLabel,
      `${profile.passengerCount} synthetic passengers and ${profile.tripCount} synthetic trips. ${profile.methodology}`,
      profile.sourceLabel,
      {
        businessMeaning: "Use for segmentation, route affinity, product preference and ACTAR sub-agent prototyping."
      }
    );

    profile.topSegments.forEach((segment) => {
      addEvidenceItem(
        items,
        "Passenger profile segment",
        segment.label,
        `${segment.label}: ${segment.passengers} synthetic passengers, ${segment.share} of the profile base.`,
        profile.sourceLabel,
        { businessMeaning: "Customer target for passenger-profile slicing." }
      );
    });

    profile.actarSlices.forEach((slice) => {
      addEvidenceItem(
        items,
        "Passenger profile ACTAR",
        `${slice.customerTarget} on ${slice.actionArea}`,
        `${slice.triggerSignal} ${slice.analysis} ${slice.recommendation}`,
        profile.sourceLabel,
        { route: "all", businessMeaning: slice.recommendation }
      );
    });
  }

  if (data.itDataFlowSummary) {
    const flow = data.itDataFlowSummary;
    addEvidenceItem(
      items,
      "IT data flow",
      flow.title,
      `${flow.status}. Accepted formats: ${flow.acceptedFormats.join(", ")}. Monitoring covers ${flow.monitoring.map((item) => item.label).join(", ")}.`,
      flow.sourceLabel,
      {
        businessMeaning: "Use for upload workflow design, schema visibility, reliability checks and Mia handoff."
      }
    );

    flow.sourceVersions.forEach((version) => {
      addEvidenceItem(
        items,
        "IT flow version",
        version.source,
        `${version.version}. ${version.state}. ${version.note}`,
        flow.sourceLabel,
        { businessMeaning: "Use when explaining version lineage, batch processing and source freshness." }
      );
    });
  }

  data.appStores.forEach((store) => {
    addEvidenceItem(items, "App store", store.platform, `${store.rating}, ${store.reviewCount}. ${store.summary}`, store.platform, {
      url: store.url,
      scoreText: store.rating
    });
  });

  data.appReviewEvidence.forEach((review) => {
    addEvidenceItem(items, "App review evidence", review.title, `${review.theme}. ${review.evidence} ${review.businessMeaning}`, review.platform, {
      scoreText: review.rating,
      businessMeaning: review.businessMeaning
    });
  });

  data.googleReviewLocations.forEach((location) => {
    addEvidenceItem(items, "Google location review", location.name, `${location.rating}, ${location.reviews}. ${location.signal}`, "Google Reviews", {
      route: location.route,
      url: location.url,
      scoreText: `${location.rating}; ${location.reviews}`
    });
  });

  data.signals.forEach((signal) => {
    addEvidenceItem(items, "Customer signal", signal.theme, `${signal.evidence} ${signal.businessMeaning}`, signal.source, {
      route: signal.route,
      businessMeaning: signal.businessMeaning
    });
  });

  data.voiceThemes.forEach((theme) => {
    addEvidenceItem(items, "Customer voice theme", theme.theme, `${theme.customerMeaning} ${theme.marketingAction} ${theme.evidence.join(" ")}`, theme.sources.join(", "), {
      route: theme.routes.join(", "),
      businessMeaning: theme.marketingAction
    });
  });

  data.rootCauses.forEach((rootCause) => {
    addEvidenceItem(items, "Root cause", rootCause.title, rootCause.summary, "Root Cause Analysis", {
      scoreText: `${rootCause.confidence} confidence; ${rootCause.impact} impact`
    });
  });

  data.competitors.forEach((competitor) => {
    addEvidenceItem(items, "Competitor benchmark", competitor.company, `${competitor.category}. Score ${competitor.score}/5 from ${competitor.reviews} reviews. ${competitor.userView} Main routes: ${competitor.routes} Overlap: ${competitor.overlap} Learning: ${competitor.learning}`, "Competitor Benchmark", {
      scoreText: `${competitor.score}/5; ${competitor.reviews} reviews`,
      businessMeaning: competitor.learning
    });
  });

  data.recommendations.forEach((recommendation) => {
    addEvidenceItem(items, "Recommendation", recommendation.title, `${recommendation.priority} priority. Expected result: ${recommendation.expectedImprovement} Reason: ${recommendation.reasoning} Evidence: ${recommendation.evidence || "Customer voice themes"}`, "Recommendations", {
      route: recommendation.routes.join(", "),
      businessMeaning: recommendation.expectedImprovement
    });
  });

  data.sources.forEach((source) => {
    addEvidenceItem(items, "Source link", source.title, source.note, "Data Basis", {
      url: source.url
    });
  });

  return items;
}

export function scoreEvidenceItem(item, tokens, route) {
  const haystack = normalizeSearchText(`${item.type} ${item.title} ${item.body} ${item.source} ${item.route}`);
  let score = 0;

  tokens.forEach((token) => {
    if (haystack.includes(token)) score += token.length > 5 ? 3 : 2;
  });

  if (route !== "all" && String(item.route).includes(route)) score += 5;
  if (item.type.includes("Recommendation")) score += tokens.includes("recommendation") || tokens.includes("action") ? 4 : 0;
  if (item.type.includes("Root cause")) score += tokens.includes("root") || tokens.includes("cause") || tokens.includes("why") ? 4 : 0;
  if (item.type.includes("Competitor")) score += tokens.includes("competitor") || tokens.includes("benchmark") ? 4 : 0;
  if (item.type.includes("App")) score += tokens.includes("app") || tokens.includes("login") || tokens.includes("booking") ? 4 : 0;
  if (item.type.includes("Passenger profile")) score += tokens.includes("profile") || tokens.includes("segment") || tokens.includes("passenger") || tokens.includes("actar") ? 5 : 0;
  if (item.type.includes("IT data flow") || item.type.includes("IT flow") || item.type.includes("Memory")) {
    score += tokens.includes("flow") || tokens.includes("upload") || tokens.includes("version") || tokens.includes("memory") || tokens.includes("schema") ? 5 : 0;
  }

  return score;
}

export function retrieveLocalEvidence(message, route = "all") {
  const tokens = tokenizeQuery(message);
  const scored = buildLocalKnowledgeBase()
    .map((item) => ({ ...item, relevance: scoreEvidenceItem(item, tokens, route) }))
    .filter((item) => item.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance);

  return scored.slice(0, 5);
}

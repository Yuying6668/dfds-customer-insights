import "./data.js?v=20260728-IT-flow-memory";
import {
  renderCoverage,
  renderLocationChart,
  renderRootCauses,
  renderRouteLens,
  renderSentimentBars,
  renderStandardization
} from "./scripts/features/overview.mjs";
import { renderAppReviews } from "./scripts/features/app-reviews.mjs";
import { renderSignals } from "./scripts/features/customer-voice.mjs";
import { renderBenchmark, renderCompetitorTable } from "./scripts/features/competitors.mjs";
import { renderRecommendations } from "./scripts/features/recommendations.mjs";
import { renderSources } from "./scripts/features/sources.mjs";
import { renderUpdateLog } from "./scripts/features/update-log.mjs";
import { renderReviewConsole } from "./scripts/features/review-console.mjs?v=20260721-0215";
import { bindChatAssistant } from "./scripts/features/chat-assistant.mjs?v=20260728-it-flow-memory";
import { bindExport } from "./scripts/features/export-brief.mjs";
import { bindCompetitorSort, bindNavigation, bindRouteFilter } from "./scripts/features/navigation.mjs";

function renderRouteDrivenViews(route) {
  renderRouteLens(route);
  renderSignals(route);
  renderRecommendations(route);
}

function init() {
  renderStandardization();
  renderSentimentBars();
  renderCoverage();
  renderRouteLens();
  renderLocationChart();
  renderRootCauses();
  renderAppReviews();
  renderSignals();
  renderBenchmark();
  renderRecommendations();
  renderSources();
  renderUpdateLog();
  renderReviewConsole();
  bindNavigation();
  bindRouteFilter(renderRouteDrivenViews);
  bindCompetitorSort(renderCompetitorTable);
  bindExport();
  bindChatAssistant();
}

init();

import { collectedAt, company, standardization, sentimentMix } from "./core.mjs";
import { routeInsights } from "./routes.mjs";
import { sourceCoverage, sources } from "./source-coverage.mjs";
import { appStores, appReviewEvidence } from "./app-reviews.mjs";
import { googleReviewLocations } from "./google-reviews.mjs";
import { rootCauses, signals, voiceThemes } from "./customer-insights.mjs";
import { competitors, competitorScope } from "./competitors.mjs";
import { recommendations } from "./recommendations.mjs";
import { supervisorLogs } from "./update-log.mjs";
import { passengerProfileSummary } from "./passenger-profile.mjs";
import { itDataFlowSummary } from "./platform-architecture.mjs";

export const dfdsIntelligenceData = {
  collectedAt,
  company,
  standardization,
  sentimentMix,
  routeInsights,
  sourceCoverage,
  appStores,
  googleReviewLocations,
  appReviewEvidence,
  rootCauses,
  signals,
  voiceThemes,
  competitors,
  competitorScope,
  supervisorLogs,
  recommendations,
  passengerProfileSummary,
  itDataFlowSummary,
  sources
};

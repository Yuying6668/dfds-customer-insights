import { dfdsIntelligenceData as data } from "../../data/index.mjs";
import { getVoiceThemes } from "../features/customer-voice.mjs";
import { getVisibleRecommendations } from "../features/recommendations.mjs";

export function buildDashboardContext(activeView, route) {
  const routeInsight = data.routeInsights[route] || data.routeInsights.all;
  const visibleThemes = getVoiceThemes(route);
  const visibleRecommendations = getVisibleRecommendations(route);
  const visibleLocations =
    route === "all"
      ? data.googleReviewLocations
      : data.googleReviewLocations.filter((location) => location.route === route);

  return {
    collectedAt: data.collectedAt,
    passengerFerryScopeOnly: true,
    activeView,
    routeFocus: {
      key: route,
      title: routeInsight.title,
      status: routeInsight.status,
      mainRisk: routeInsight.risk,
      nextAction: routeInsight.action
    },
    itDataFlow: {
      title: data.itDataFlowSummary.title,
      status: data.itDataFlowSummary.status,
      sourceSystems: data.itDataFlowSummary.sourceSystems,
      monitoring: data.itDataFlowSummary.monitoring.map((item) => ({
        label: item.label,
        value: item.value,
        detail: item.detail
      })),
      sourceVersions: data.itDataFlowSummary.sourceVersions.map((item) => ({
        source: item.source,
        version: item.version,
        state: item.state,
        note: item.note
      }))
    },
    topMetrics: {
      brandReviews: "Trustpilot 4.2 / 5 from 20,646 reviews",
      androidApp: `${data.appStores[0].rating} from ${data.appStores[0].reviewCount}`,
      iosApp: `${data.appStores[1].rating} from ${data.appStores[1].reviewCount}`,
      sentimentMix: data.sentimentMix.map((item) => `${item.label}: ${item.value}%`).join("; ")
    },
    activePageSignals: {
      customerVoiceThemes: visibleThemes.length,
      recommendations: visibleRecommendations.length,
      passengerProfile:
        activeView === "Passenger Profile" || activeView === "Survey CSV" || activeView === "Survey Intake"
          ? {
              passengers: data.passengerProfileSummary.passengerCount,
              trips: data.passengerProfileSummary.tripCount,
              topSegments: data.passengerProfileSummary.topSegments.map((segment) => `${segment.label}: ${segment.share}`),
              routeAffinity: data.passengerProfileSummary.routeAffinity.map((routeItem) => `${routeItem.label}: ${routeItem.share}`),
              actarSlices: data.passengerProfileSummary.actarSlices.map((slice) => ({
                actionArea: slice.actionArea,
                customerTarget: slice.customerTarget,
                recommendation: slice.recommendation
              })),
              synthetic: true
            }
          : {
              passengers: data.passengerProfileSummary.passengerCount,
              trips: data.passengerProfileSummary.tripCount,
              synthetic: true
            },
      isItFlowPage: activeView === "IT Data Flow" || activeView === "Data Basis",
      googleReviewLocations: visibleLocations.map((location) => ({
        name: location.name,
        rating: location.rating,
        reviews: location.reviews,
        route: location.route
      })),
      appStores: data.appStores.map((store) => ({
        platform: store.platform,
        rating: store.rating,
        reviewCount: store.reviewCount,
        status: store.status
      }))
    }
  };
}

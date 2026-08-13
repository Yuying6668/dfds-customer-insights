export const INSIGHT_CONCEPTS = {
  "customer-voice": new Set(["rating", "nps", "csat", "route", "market", "language", "country"]),
  "app-reviews": new Set(["rating"]),
  "passenger-profile": new Set(["route", "market", "country", "language", "bookings", "revenue"]),
  competitors: new Set(["rating", "market", "route"])
};

export function datasetSupportsInsight(route, analytics) {
  const available = analytics?.schemaAvailability?.availableConcepts || [];
  const required = INSIGHT_CONCEPTS[route];
  return Boolean(required && available.some((concept) => required.has(concept)));
}

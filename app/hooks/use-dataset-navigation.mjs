import { useEffect, useState } from "react";
import { getDatasetRunAnalytics, subscribeDatasetRun } from "../scripts/services/dataset-run-api.mjs";
import { getInsightNavigationState, mergeDatasetRunNavigationSnapshot } from "../lib/dataset-insight-routing.mjs";

const INSIGHT_ROUTES = ["customer-voice", "app-reviews", "passenger-profile", "competitors"];
const initialNavigationKey = (analytics) => JSON.stringify(analytics || null);

export function useDatasetNavigation(activeDatasetRun, initialAnalytics = null) {
  const [analytics, setAnalytics] = useState(null);
  const prefillKey = initialNavigationKey(initialAnalytics);
  useEffect(() => {
    if (!activeDatasetRun || activeDatasetRun === "public") { setAnalytics(null); return undefined; }
    let active = true;
    const matchingInitialAnalytics = initialAnalytics?.batchId === activeDatasetRun ? initialAnalytics : null;
    setAnalytics(matchingInitialAnalytics);
    const load = () => getDatasetRunAnalytics(activeDatasetRun).then((payload) => { if (active) setAnalytics(payload); }).catch(() => { if (active) setAnalytics(null); });
    load();
    const close = subscribeDatasetRun(activeDatasetRun, (event) => {
      const datasetRun = event.datasetRun || {};
      if (["ready", "failed"].includes(datasetRun.analysisState)) load();
      else if (active) setAnalytics((current) => mergeDatasetRunNavigationSnapshot(current, event));
    });
    return () => { active = false; close?.(); };
  }, [activeDatasetRun, prefillKey]);
  return Object.fromEntries(INSIGHT_ROUTES.map((route) => [route, getInsightNavigationState(route, { activeDatasetRun, analytics })]));
}

import { useEffect, useState } from "react";
import { getDatasetRunAnalytics, subscribeDatasetRun } from "../scripts/services/dataset-run-api.mjs";
import { datasetSupportsInsight } from "../lib/dataset-insight-routing.mjs";

export function useDatasetInsight(route) {
  const datasetRunId = new URLSearchParams(window.location.search).get("datasetRun");
  const [state, setState] = useState({ analytics: null, loading: Boolean(datasetRunId), supported: false });
  useEffect(() => {
    if (!datasetRunId) { setState({ analytics: null, loading: false, supported: false }); return undefined; }
    let active = true;
    const load = () => getDatasetRunAnalytics(datasetRunId).then((analytics) => { if (active) setState({ analytics, loading: Boolean(analytics.analysisState), supported: datasetSupportsInsight(route, analytics) }); }).catch(() => { if (active) setState({ analytics: null, loading: false, supported: false }); });
    load();
    const close = subscribeDatasetRun(datasetRunId, (event) => { if (["ready", "failed"].includes(event.datasetRun?.analysisState)) load(); });
    return () => { active = false; close?.(); };
  }, [datasetRunId, route]);
  return state;
}

const SURVEY_LIFECYCLE = [
  { key: "capture", label: "Capture" },
  { key: "profile", label: "Profile" },
  { key: "clean", label: "Clean" },
  { key: "standardise", label: "Standardise" },
  { key: "validate", label: "Validate" },
  { key: "publish", label: "Publish" }
];

const ACCEPTED_EXTENSIONS = new Set(["csv", "xlsx", "xls"]);
const LIFECYCLE_STATES = new Set(["complete", "active", "pending", "needs_review"]);

export function isAcceptedSurveyFile(file) {
  const extension = String(file?.name || "").split(".").pop().toLowerCase();
  return ACCEPTED_EXTENSIONS.has(extension);
}

function normalizeLifecycleState(state) {
  if (LIFECYCLE_STATES.has(state)) return state;
  if (["complete", "completed", "done", "ready"].includes(state)) return "complete";
  if (["active", "in_progress", "processing", "running"].includes(state)) return "active";
  if (["needs_review", "blocked", "failed", "error"].includes(state)) return "needs_review";
  return "pending";
}

export function getSurveyLifecycleStages(lifecycle = []) {
  const lifecycleEntries = Array.isArray(lifecycle) ? lifecycle : [];
  const hasKeyedStages = lifecycleEntries.some((stage) => stage?.key);
  const stagesByKey = new Map(lifecycleEntries.filter((stage) => stage?.key).map((stage) => [stage.key, stage]));

  return SURVEY_LIFECYCLE.map((stage, index) => {
    const source = stagesByKey.get(stage.key) || (!hasKeyedStages ? lifecycleEntries[index] : undefined) || {};
    return {
      key: stage.key,
      label: stage.label,
      detail: source.detail || "",
      state: source.state == null && index === 0 ? "active" : normalizeLifecycleState(source.state)
    };
  });
}

export function surveyPreviewCounts(batch) {
  return (batch?.files || []).flatMap((file) => file.sheets || []).reduce((total, sheet) => {
    const cleaning = sheet.cleaning || {};
    return {
      cleanedRows: total.cleanedRows + (cleaning.cleanedRows || 0),
      columns: total.columns + (sheet.columns || []).length,
      mappingExceptions: total.mappingExceptions + (cleaning.mappingExceptions || 0)
    };
  }, { cleanedRows: 0, columns: 0, mappingExceptions: 0 });
}

export function getPersistedSurveyReviewState(batch) {
  const aiReview = batch?.aiReview || null;
  return {
    aiReview,
    aiReviewState: aiReview ? "complete" : "idle"
  };
}

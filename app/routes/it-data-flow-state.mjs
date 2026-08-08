export const LIFECYCLE_LABELS = [
  "Upload",
  "Validate",
  "Classify",
  "Map",
  "Review",
  "Ready for Mia"
];

export function formatBytes(bytes) {
  if (!bytes) return "0 KB";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = value >= 10 || unitIndex === 0 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded} ${units[unitIndex]}`;
}

export function getFileTypeLabel(fileName = "") {
  const extension = String(fileName).split(".").pop().toLowerCase();
  if (extension === "docx" || extension === "doc") return "Word";
  if (extension === "pdf") return "PDF";
  if (extension === "txt") return "TXT";
  return extension.toUpperCase() || "FILE";
}

export function buildBatchSummary(files, acceptedFormats, previewLines) {
  const fileTypes = [...new Set(files.map((file) => getFileTypeLabel(file.name)))];
  const latestFile = files[0];

  return {
    count: files.length,
    totalSize: formatBytes(files.reduce((total, file) => total + file.size, 0)),
    fileTypes: fileTypes.length ? fileTypes.join(" / ") : acceptedFormats.map((format) => format.toUpperCase()).join(" / "),
    latestFileName: latestFile?.name || "No files uploaded yet",
    latestFileSize: latestFile ? formatBytes(latestFile.size) : "Waiting",
    batchState: files.length ? "Ready for validation" : "Awaiting upload",
    previewLines: files.length ? previewLines : previewLines.slice(0, 2)
  };
}

export function getLifecycleStages(lifecycleOrFileCount) {
  if (Array.isArray(lifecycleOrFileCount)) {
    return lifecycleOrFileCount.map((stage) => ({
      key: stage.key,
      label: stage.label,
      detail: stage.detail || "",
      state: stage.state || "pending"
    }));
  }
  const fileCount = lifecycleOrFileCount;
  return LIFECYCLE_LABELS.map((label, index) => ({
    label,
    state: index === 0 && fileCount ? "complete" : index === 1 && fileCount ? "active" : index === 0 ? "active" : "pending"
  }));
}

export function getPersistedITDataFlowReviewState(batch) {
  const aiReview = batch?.aiReview || null;
  return {
    aiReview,
    aiReviewState: aiReview ? "complete" : "idle"
  };
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DataTable } from "../components/common.jsx";
import { ExceptionRowReview } from "../components/ExceptionRowReview.jsx";
import { getAccessToken } from "../lib/auth.js";
import { reviewUploadedBatch, uploadBatch } from "../scripts/services/upload-batch-api.mjs";
import { activateDatasetRun, publishDatasetRun } from "../scripts/services/dataset-run-api.mjs";
import { navigate } from "../lib/router.js";
import { getPersistedSurveyReviewState, getSurveyLifecycleStages, isAcceptedSurveyFile, surveyPreviewCounts } from "./survey-csv-state.mjs";

function maskedRows(sheet, data, page, pageSize) {
  const restricted = /email|loyalty|customer|account|device|alias/i;
  const columns = data?.columns || sheet.columns;
  const sourceRows = data?.rows || sheet.previewRows || [];
  const rows = data ? sourceRows : sourceRows.slice((page - 1) * pageSize, page * pageSize);
  return rows.map((row, index) => Object.fromEntries([
    ...columns.map((column) => [
      column,
      restricted.test(column) && row[column] ? "Restricted" : row[column] == null || row[column] === "" ? <span className="missing-value">null</span> : row[column]
    ]),
    ["key", `${sheet.key}-${page}-${index}`]
  ]));
}

function standardFieldFor(column) {
  const lower = column.toLowerCase();
  if (/response|survey.*id/.test(lower)) return "response_id";
  if (/route|crossing/.test(lower)) return "route";
  if (/rating|score|nps|csat/.test(lower)) return "rating";
  if (/text|comment|feedback/.test(lower)) return "free_text";
  if (/date|time/.test(lower)) return "response_at";
  if (/age/.test(lower)) return "age_band";
  if (/travel|purpose/.test(lower)) return "travel_reason";
  return "source_attribute";
}

export function SurveyCsvRoute({ onUploadedBatchChange, initialUploadedBatch, onDatasetPublished }) {
  const persistedReviewState = getPersistedSurveyReviewState(initialUploadedBatch);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedBatch, setUploadedBatch] = useState(initialUploadedBatch);
  const [uploadState, setUploadState] = useState(initialUploadedBatch ? "uploaded" : "idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [aiReview, setAiReview] = useState(persistedReviewState.aiReview);
  const [aiReviewState, setAiReviewState] = useState(persistedReviewState.aiReviewState);
  const [selectedSheetKey, setSelectedSheetKey] = useState("");
  const [previewTab, setPreviewTab] = useState("standardised");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sheetData, setSheetData] = useState(null);
  const [sheetError, setSheetError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [publishState, setPublishState] = useState("idle");
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [isDragActive, setIsDragActive] = useState(false);
  const [exceptionSheetKey, setExceptionSheetKey] = useState("");
  const dragDepthRef = useRef(0);

  const sheets = useMemo(() => (uploadedBatch?.files || []).flatMap((file) => (file.sheets || []).map((sheet) => ({
    ...sheet,
    fileId: file.id,
    source: file.name,
    rowCount: sheet.cleaning?.cleanedRows || sheet.previewRows?.length || 0,
    key: `${file.id}:${sheet.name}`
  }))), [uploadedBatch]);
  const selectedSheet = sheets.find((sheet) => sheet.key === selectedSheetKey) || sheets[0];
  const lifecycleStages = getSurveyLifecycleStages(uploadedBatch?.batch?.lifecycle || []);
  const counts = surveyPreviewCounts(uploadedBatch);
  const columns = sheetData?.columns || selectedSheet?.columns || [];
  const totalRows = sheetData?.totalRows || selectedSheet?.rowCount || 0;
  const totalPages = sheetData?.totalPages || Math.max(1, Math.ceil(totalRows / pageSize));
  const mappings = columns.map((column) => ({ source: column, standard: standardFieldFor(column), state: standardFieldFor(column) === "source_attribute" ? "Review" : "Mapped" }));
  const exceptions = (uploadedBatch?.files || []).flatMap((file) => (file.sheets || []).flatMap((sheet) => {
    const count = sheet.cleaning?.mappingExceptions || 0;
    return count ? [{ key: `${file.id}-${sheet.name}`, fileId: file.id, sheet: sheet.name, count, detail: "Values could not be mapped to the survey standard." }] : [];
  }));
  const datasetOverview = aiReview?.datasetOverview || {
    recordCount: aiReview?.fileOverview?.profiledRows || counts.cleanedRows,
    dataSources: [],
    timePeriod: "Not identified",
    countries: [],
    routes: [],
    languages: []
  };
  const businessReview = {
    datasetSummary: aiReview?.review?.datasetSummary || aiReview?.review?.summary || "No business summary is available for this upload.",
    mainBusinessTopics: {
      customerThemes: aiReview?.review?.mainBusinessTopics?.customerThemes || [],
      serviceAreas: aiReview?.review?.mainBusinessTopics?.serviceAreas || [],
      operations: aiReview?.review?.mainBusinessTopics?.operations || []
    },
    keyInsights: aiReview?.review?.keyInsights || []
  };

  useEffect(() => {
    if (!uploadedBatch || !selectedSheet) return undefined;
    const controller = new AbortController();
    setSheetData(null);
    setSheetError("");
    fetch(`/api/upload-batches/${encodeURIComponent(uploadedBatch.batch.id)}/sheets?file_id=${encodeURIComponent(selectedSheet.fileId)}&sheet=${encodeURIComponent(selectedSheet.name)}&page=${page}&page_size=${pageSize}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${getAccessToken()}` }
    })
      .then((response) => {
        if (!response.ok) throw new Error("Survey responses could not be loaded");
        return response.json();
      })
      .then(setSheetData)
      .catch((error) => {
        if (error.name !== "AbortError") setSheetError("Showing the available sample rows while the uploaded survey is unavailable.");
      });
    return () => controller.abort();
  }, [uploadedBatch, selectedSheet, page, pageSize]);

  const uploadFiles = async (files) => {
    const candidates = Array.from(files || []);
    const accepted = candidates.filter(isAcceptedSurveyFile);
    const rejected = candidates.filter((file) => !isAcceptedSurveyFile(file));
    setSelectedFiles(accepted);
    setUploadedBatch(null);
    onUploadedBatchChange?.(null);
    setAiReview(null);
    setSheetData(null);
    setUploadProgress(0);
    if (!accepted.length) {
      setUploadState("failed");
      setUploadError(rejected.length ? `Unsupported file type: ${rejected.map((file) => file.name).join(", ")}` : "Choose one or more CSV or Excel files to upload");
      return;
    }
    setUploadState("uploading");
    setUploadError("");
    try {
      const batch = await uploadBatch(accepted, { onProgress: setUploadProgress, sourceType: "survey" });
      const firstSheet = batch.files.flatMap((file) => (file.sheets || []).map((sheet) => ({ file, sheet })))[0];
      setUploadedBatch(batch);
      onUploadedBatchChange?.(batch);
      setSelectedSheetKey(firstSheet ? `${firstSheet.file.id}:${firstSheet.sheet.name}` : "");
      setPage(1);
      setUploadState("uploaded");
      setAiReviewState("loading");
      try {
        const review = await reviewUploadedBatch(batch.batch.id);
        setAiReview(review);
        onUploadedBatchChange?.({ ...batch, aiReview: review });
        setAiReviewState("complete");
        setPublishState("publishing");
        const activated = await activateDatasetRun(batch.batch.id);
        const activatedBatch = { ...batch, batch: { ...batch.batch, ...activated.batch }, aiReview: review };
        setUploadedBatch(activatedBatch);
        onUploadedBatchChange?.(activatedBatch);
        setSaveState("saved");
        setPublishState("published");
        onDatasetPublished?.(batch.batch.id);
      } catch (error) {
        setAiReviewState("failed");
        setUploadError(error.message);
      }
    } catch (error) {
      setUploadState("failed");
      setUploadError(error.message);
    }
  };

  const saveCleanedData = async () => {
    if (!uploadedBatch || saveState === "saving") return;
    setSaveState("saving");
    try {
      const response = await fetch(`/api/upload-batches/${encodeURIComponent(uploadedBatch.batch.id)}/save-cleaned`, { method: "POST", headers: { Authorization: `Bearer ${getAccessToken()}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Cleaned survey data could not be saved");
      setUploadedBatch((current) => ({ ...current, batch: { ...current.batch, ...payload.batch } }));
      setSaveState("saved");
    } catch {
      setSaveState("failed");
    }
  };

  const exportCleanedData = async () => {
    if (!uploadedBatch) return;
    try {
      const response = await fetch(`/api/upload-batches/${encodeURIComponent(uploadedBatch.batch.id)}/export?format=${encodeURIComponent(exportFormat)}&file_id=${encodeURIComponent(selectedSheet.fileId || "")}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
      if (!response.ok) throw new Error("Cleaned survey data could not be exported");
      const downloadUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `standardised-survey.${exportFormat}`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setUploadError(error.message);
    }
  };

  const publishToInsights = async () => {
    if (!uploadedBatch || publishState === "publishing") return;
    setPublishState("publishing");
    try {
      await publishDatasetRun(uploadedBatch.batch.id);
      setPublishState("published");
      onDatasetPublished?.(uploadedBatch.batch.id);
    } catch (error) { setPublishState("failed"); setUploadError(error.message); }
  };

  return <section className="view active it-data-workspace">
    <header className="it-workspace-heading"><p className="eyebrow">Data intake</p><h3>Survey Intake</h3><p>Bring internal questionnaire responses into the governed customer-evidence workflow.</p></header>
    <section className={`batch-intake-surface${uploadedBatch ? "" : " batch-intake-surface--empty"}${isDragActive ? " drag-active" : ""}`} aria-label="Upload survey CSV" onDragEnter={(event) => { event.preventDefault(); dragDepthRef.current += 1; setIsDragActive(true); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDragLeave={(event) => { event.preventDefault(); dragDepthRef.current -= 1; if (dragDepthRef.current <= 0) { dragDepthRef.current = 0; setIsDragActive(false); } }} onDrop={(event) => { event.preventDefault(); dragDepthRef.current = 0; setIsDragActive(false); uploadFiles(event.dataTransfer.files); }}>
      <div className="upload-intake-details"><strong>Upload a survey CSV</strong><small>{isDragActive ? "Release to upload" : "Drop questionnaire exports here or choose files."}</small><div className="upload-formats" aria-label="Accepted file formats"><span className="format-label">Formats</span><span>CSV</span><span>XLS</span><span>XLSX</span></div><span className="upload-drop-indicator" aria-hidden="true">+</span><label className="primary-button upload-button" htmlFor="surveyCsvUpload">Choose files</label></div>
      <input id="surveyCsvUpload" className="sr-only" type="file" accept=".csv,.xls,.xlsx" multiple onChange={(event) => { uploadFiles(event.target.files); event.target.value = ""; }} />
      {uploadState === "uploading" || uploadedBatch ? <div className={`upload-progress${uploadState === "uploaded" ? " complete" : ""}`} role="status"><div><span>{uploadState === "uploaded" ? `Survey preview updated - ${(selectedFiles.length || uploadedBatch?.batch?.fileCount || 0)} file${(selectedFiles.length || uploadedBatch?.batch?.fileCount || 0) === 1 ? "" : "s"}` : "Uploading questionnaire export"}</span><strong>{uploadState === "uploaded" ? "100%" : `${uploadProgress}%`}</strong></div><span className="upload-progress-track" aria-hidden="true"><i style={{ width: `${uploadState === "uploaded" ? 100 : uploadProgress}%` }} /></span></div> : null}
      {uploadError ? <p className="upload-error" role="alert">{uploadError}</p> : null}
      {uploadedBatch?.batch?.version ? <p className="upload-version">Survey version: {uploadedBatch.batch.version}</p> : null}
    </section>
    {uploadedBatch ? <ol className="batch-lifecycle" aria-label="Survey standardisation lifecycle">{lifecycleStages.map((stage, index) => <li key={stage.key} className={stage.state}><span>{index + 1}</span><div><strong>{stage.label}</strong><small>{stage.detail}</small></div></li>)}</ol> : null}
    {uploadedBatch ? <section className="ai-review-result" aria-live="polite" aria-labelledby="surveyMiaReviewTitle"><p className="eyebrow">MIA summary</p><h4 id="surveyMiaReviewTitle">What the uploaded data shows</h4>{aiReviewState === "loading" ? <p>Preparing the survey business summary.</p> : null}{aiReviewState === "failed" ? <p>A MIA summary is not available for this upload.</p> : null}{aiReview ? <div className="ai-review-findings ai-business-review"><article className="business-overview-panel"><h5>Dataset Overview</h5><dl className="dataset-overview-grid"><div><dt>Records</dt><dd>{datasetOverview.recordCount.toLocaleString()}</dd></div><div><dt>Data sources</dt><dd>{datasetOverview.dataSources.join(", ") || "Not identified"}</dd></div><div><dt>Time period</dt><dd>{datasetOverview.timePeriod}</dd></div><div><dt>Countries</dt><dd>{datasetOverview.countries.join(", ") || "Not identified"}</dd></div><div><dt>Routes</dt><dd>{datasetOverview.routes.join(", ") || "Not identified"}</dd></div><div><dt>Languages</dt><dd>{datasetOverview.languages.join(", ") || "Not identified"}</dd></div></dl><h5>Main Business Topics</h5><div className="business-topic-groups"><div><strong>Customer themes</strong><p>{businessReview.mainBusinessTopics.customerThemes.join(" · ") || "Not identified"}</p></div><div><strong>Service areas</strong><p>{businessReview.mainBusinessTopics.serviceAreas.join(" · ") || "Not identified"}</p></div><div><strong>Operations</strong><p>{businessReview.mainBusinessTopics.operations.join(" · ") || "Not identified"}</p></div></div><h5>Dataset Summary</h5><p className="ai-review-summary">{businessReview.datasetSummary}</p></article><article className="key-insights-panel"><h5>Key Insights</h5>{businessReview.keyInsights.length ? <div className="key-insight-grid">{businessReview.keyInsights.map((insight) => <section key={`${insight.title}-${insight.detail}`} className="key-insight-card"><strong>{insight.title}</strong><p>{insight.detail}</p></section>)}</div> : <p>No key business insights were identified from the uploaded rows.</p>}</article></div> : null}</section> : null}
    {uploadedBatch && selectedSheet ? <section className="workbook-preview-panel survey-standardisation-preview" aria-labelledby="surveyPreviewTitle"><div className="workbook-preview-header"><div><p className="eyebrow">Questionnaire standardisation preview</p><h4 id="surveyPreviewTitle">Cleaned survey evidence</h4></div><div className="cleaned-data-actions"><button className="text-button" type="button" onClick={saveCleanedData} disabled={saveState === "saving" || publishState === "published"}>{saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : "Save cleaned data"}</button><button className="primary-button" type="button" onClick={publishToInsights} disabled={saveState !== "saved" || publishState === "publishing"}>{publishState === "published" ? "Published" : publishState === "publishing" ? "Publishing..." : "Publish to Insights"}</button>{publishState === "published" ? <button className="text-button" type="button" onClick={() => navigate(`/overview?datasetRun=${encodeURIComponent(uploadedBatch.batch.id)}`)}>View insights</button> : null}<select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)} aria-label="Export format"><option value="xlsx">Excel</option><option value="csv">CSV</option></select><button className="text-button" type="button" onClick={exportCleanedData}>Export</button></div></div>
      <div className="workbook-tabs" role="tablist" aria-label="Survey worksheets">{sheets.map((sheet) => <button key={sheet.key} className={sheet.key === selectedSheet.key ? "active" : ""} type="button" role="tab" aria-selected={sheet.key === selectedSheet.key} onClick={() => { setSelectedSheetKey(sheet.key); setPage(1); }}><strong>{sheet.name}</strong><small>{sheet.rowCount} rows</small></button>)}</div>
      <div className="workbook-tabs survey-preview-tabs" role="tablist" aria-label="Survey preview views">{[["standardised", "Standardised responses"], ["mapping", "Question mapping"], ["exceptions", "Exceptions"]].map(([key, label]) => <button key={key} className={previewTab === key ? "active" : ""} type="button" role="tab" aria-selected={previewTab === key} onClick={() => setPreviewTab(key)}><strong>{label}</strong></button>)}</div>
      {sheetError ? <p className="workbook-load-error">{sheetError}</p> : null}
      {previewTab === "standardised" ? <><div className="worksheet-context"><span>{selectedSheet.source}</span><strong>{selectedSheet.name}</strong><small>{columns.length} fields / {totalRows} cleaned rows</small></div><DataTable columns={columns} rows={maskedRows(selectedSheet, sheetData, page, pageSize)} /><div className="workbook-pagination" aria-label="Survey response pagination"><label>Rows per page<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label><span>Page {page} of {totalPages}</span><button className="text-button" type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="text-button" type="button" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></> : null}
      {previewTab === "mapping" ? <div className="survey-mapping-list" role="table">{mappings.map((mapping) => <div className="survey-mapping-row" role="row" key={mapping.source}><strong>{mapping.source}</strong><span>{mapping.standard}</span><small>{mapping.state}</small></div>)}</div> : null}
      {previewTab === "exceptions" ? exceptions.length ? <><div className="survey-mapping-list">{exceptions.map((exception) => <div className="survey-mapping-row" key={exception.key}><strong>{exception.sheet}</strong><span>{exception.detail}</span><small>{exception.count} rows</small><button className="text-button" type="button" onClick={() => setExceptionSheetKey(exception.key)}>{exceptionSheetKey === exception.key ? "Reviewing rows" : "Review rows"}</button></div>)}</div>{exceptionSheetKey ? <ExceptionRowReview batchId={uploadedBatch.batch.id} fileId={exceptions.find((item) => item.key === exceptionSheetKey)?.fileId} sheetName={exceptions.find((item) => item.key === exceptionSheetKey)?.sheet} /> : null}</> : <p className="panel-note">No mapping exceptions were found in this uploaded survey.</p> : null}
    </section> : null}
  </section>;
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { DataTable } from "../components/common.jsx";
import { ExceptionRowReview } from "../components/ExceptionRowReview.jsx";
import { reviewUploadedBatch, uploadBatch } from "../scripts/services/upload-batch-api.mjs";
import { activateDatasetRun, publishDatasetRun } from "../scripts/services/dataset-run-api.mjs";
import { navigate } from "../lib/router.js";
import { getAccessToken } from "../lib/auth.js";
import { getLifecycleStages, getPersistedITDataFlowReviewState } from "./it-data-flow-state.mjs";

const ACCEPTED_EXTENSIONS = new Set(["xlsx", "xls", "csv", "txt", "pdf", "doc", "docx"]);

function isAcceptedFile(file) {
  return ACCEPTED_EXTENSIONS.has(String(file.name).split(".").pop().toLowerCase());
}

export function ITDataFlowRoute({ data, onUploadedBatchChange, initialUploadedBatch, onDatasetPublished }) {
  const summary = data.itDataFlowSummary;
  const persistedReviewState = getPersistedITDataFlowReviewState(initialUploadedBatch);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadState, setUploadState] = useState(initialUploadedBatch ? "uploaded" : "idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadedBatch, setUploadedBatch] = useState(initialUploadedBatch);
  const [aiReview, setAiReview] = useState(persistedReviewState.aiReview);
  const [aiReviewState, setAiReviewState] = useState(persistedReviewState.aiReviewState);
  const [reviewElapsedSeconds, setReviewElapsedSeconds] = useState(0);
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [saveState, setSaveState] = useState("idle");
  const [publishState, setPublishState] = useState("idle");
  const [selectedWorkbookSheet, setSelectedWorkbookSheet] = useState("source:Bookings");
  const [workbookPage, setWorkbookPage] = useState(1);
  const [workbookPageSize, setWorkbookPageSize] = useState(50);
  const [workbookData, setWorkbookData] = useState(null);
  const [workbookLoadError, setWorkbookLoadError] = useState("");
  const [workbookPreviewTab, setWorkbookPreviewTab] = useState("standardised");
  const [exceptionSheetKey, setExceptionSheetKey] = useState("");
  const dragDepthRef = useRef(0);
  const sourceWorkbookSheets = useMemo(
    () => summary.sourceWorkbookPreview.map((item) => ({ ...item, key: `source:${item.sheet}` })),
    [summary.sourceWorkbookPreview]
  );
  const uploadedWorkbookSheets = useMemo(
    () => (uploadedBatch?.files || []).flatMap((file) => file.sheets.map((sheet) => ({
      ...sheet,
      key: `uploaded:${file.id}:${sheet.name}`,
      sheet: sheet.name,
      source: file.name,
      fileId: file.id,
      rowCount: sheet.cleaning.cleanedRows,
      rows: sheet.previewRows,
      isUploaded: true
    }))),
    [uploadedBatch]
  );
  const workbookSheets = uploadedWorkbookSheets.length ? uploadedWorkbookSheets : sourceWorkbookSheets;
  const workbookSheet = workbookSheets.find((item) => item.key === selectedWorkbookSheet) || workbookSheets[0];
  const restrictedFieldPattern = /email|customer_ref|crm_contact|loyalty_no|account_hash|device_hash|alias_value/i;
  const workbookRows = workbookSheet.rows.map((row, index) =>
    Object.fromEntries(
      workbookSheet.columns.map((column) => [
        column,
        restrictedFieldPattern.test(column) && row[column] ? "Restricted" : row[column]
      ]).concat([["key", `${workbookSheet.sheet}-${index}`]])
    )
  );
  const workbookColumns = workbookData?.columns || workbookSheet.columns;
  const availableWorkbookRows = workbookData?.rows || workbookRows;
  const displayedWorkbookRows = (workbookData ? availableWorkbookRows : availableWorkbookRows
    .slice((workbookPage - 1) * workbookPageSize, workbookPage * workbookPageSize))
    .map((row, index) => Object.fromEntries([
      ...workbookColumns.map((column) => [
        column,
        row[column] == null || row[column] === ""
          ? <span className="missing-value">null</span>
          : row[column]
      ]),
      ["key", `${workbookSheet.sheet}-${workbookPage}-${index}`]
    ]));
  const workbookTotalRows = workbookData?.totalRows || workbookSheet.rowCount;
  const workbookTotalPages = workbookData?.totalPages || Math.max(1, Math.ceil(workbookSheet.rowCount / workbookPageSize));
  const lifecycleStages = getLifecycleStages(uploadedBatch?.batch?.lifecycle || []);
  const cleaningOutcome = useMemo(
    () => (uploadedBatch?.files || []).flatMap((file) => file.sheets).reduce((total, sheet) => {
      const cleaning = sheet.cleaning || {};
      return {
        receivedRows: total.receivedRows + (cleaning.receivedRows || 0),
        cleanedRows: total.cleanedRows + (cleaning.cleanedRows || 0),
        blankRowsRemoved: total.blankRowsRemoved + (cleaning.blankRowsRemoved || 0),
        duplicateRowsRemoved: total.duplicateRowsRemoved + (cleaning.duplicateRowsRemoved || 0),
        missingValuesStandardized: total.missingValuesStandardized + (cleaning.missingValuesStandardized || 0),
        mappedValues: total.mappedValues + (cleaning.mappedValues || 0),
        mappingExceptions: total.mappingExceptions + (cleaning.mappingExceptions || 0),
        invalidDateValues: total.invalidDateValues + (cleaning.invalidDateValues || 0),
        invalidAmountValues: total.invalidAmountValues + (cleaning.invalidAmountValues || 0),
        invalidRatingValues: total.invalidRatingValues + (cleaning.invalidRatingValues || 0),
        unmappedRouteValues: total.unmappedRouteValues + (cleaning.unmappedRouteValues || 0),
        enumValuesStandardized: total.enumValuesStandardized + (cleaning.enumValuesStandardized || 0),
        enumExceptions: total.enumExceptions + (cleaning.enumExceptions || 0),
        missingKeyValues: total.missingKeyValues + (cleaning.missingKeyValues || 0),
        duplicateKeyValues: total.duplicateKeyValues + (cleaning.duplicateKeyValues || 0),
        mixedAgeFormats: total.mixedAgeFormats + (cleaning.mixedAgeFormats || 0),
        ambiguousReferenceColumns: total.ambiguousReferenceColumns + (cleaning.ambiguousReferenceColumns || 0)
      };
    }, {
      receivedRows: 0,
      cleanedRows: 0,
      blankRowsRemoved: 0,
      duplicateRowsRemoved: 0,
      missingValuesStandardized: 0,
      mappedValues: 0,
      mappingExceptions: 0,
      invalidDateValues: 0,
      invalidAmountValues: 0,
      invalidRatingValues: 0,
      unmappedRouteValues: 0,
      enumValuesStandardized: 0,
      enumExceptions: 0,
      missingKeyValues: 0,
      duplicateKeyValues: 0,
      mixedAgeFormats: 0,
      ambiguousReferenceColumns: 0
    }),
    [uploadedBatch]
  );
  const workbookExceptions = useMemo(
    () => (uploadedBatch?.files || []).flatMap((file) => (file.sheets || []).flatMap((sheet) => {
      const count = sheet.cleaning?.mappingExceptions || 0;
      return count ? [{
        key: `${file.id}-${sheet.name}`,
        sheet: sheet.name,
        source: file.name,
        fileId: file.id,
        count
      }] : [];
    })),
    [uploadedBatch]
  );
  const uploadProgressLabel = uploadState === "uploaded"
    ? `Source workbook preview updated · ${uploadedBatch?.batch.version || "latest version"}`
    : uploadProgress >= 90
      ? "Cleaning and preparing the source workbook preview"
      : "Uploading source files";
  const datasetOverview = aiReview?.datasetOverview || {
    recordCount: aiReview?.fileOverview?.profiledRows || 0,
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
    const controller = new AbortController();
    setWorkbookLoadError("");
    setWorkbookData(null);
    const url = workbookSheet.isUploaded
      ? `/api/upload-batches/${encodeURIComponent(uploadedBatch.batch.id)}/sheets?file_id=${encodeURIComponent(workbookSheet.fileId)}&sheet=${encodeURIComponent(workbookSheet.sheet)}&page=${workbookPage}&page_size=${workbookPageSize}`
      : `/api/source-workbook?sheet=${encodeURIComponent(workbookSheet.sheet)}&page=${workbookPage}&page_size=${workbookPageSize}`;
    fetch(url, {
      signal: controller.signal,
      headers: workbookSheet.isUploaded ? { Authorization: `Bearer ${getAccessToken()}` } : {}
    })
      .then((response) => {
        if (!response.ok) throw new Error("Source workbook could not be loaded");
        return response.json();
      })
      .then((payload) => setWorkbookData(payload))
      .catch((error) => {
        if (error.name !== "AbortError") setWorkbookLoadError("Showing the available sample rows while the source workbook is unavailable.");
      });
    return () => controller.abort();
  }, [workbookSheet, workbookPage, workbookPageSize, uploadedBatch]);

  useEffect(() => {
    if (aiReviewState !== "loading") return undefined;
    setReviewElapsedSeconds(0);
    const startedAt = Date.now();
    const timer = window.setInterval(() => setReviewElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [aiReviewState]);

  const uploadFiles = async (files) => {
    const nextFiles = Array.from(files || []);
    const rejected = nextFiles.filter((file) => !isAcceptedFile(file));
    const accepted = nextFiles.filter(isAcceptedFile);
    setSelectedFiles(accepted);
    setUploadedBatch(null);
    onUploadedBatchChange?.(null);
      setAiReview(null);
      setAiReviewState("idle");
      setReviewElapsedSeconds(0);
    setUploadProgress(0);
    if (!accepted.length) {
      setUploadState("failed");
      setUploadError(rejected.length ? `Unsupported file type: ${rejected.map((file) => file.name).join(", ")}` : "Choose one or more files to upload");
      return;
    }

    setUploadState("uploading");
    setUploadError("");
    try {
      const batch = await uploadBatch(accepted, { onProgress: setUploadProgress, sourceType: "it_data" });
      setUploadedBatch(batch);
      onUploadedBatchChange?.(batch);
      const firstProfiledSheet = batch.files.flatMap((file) => file.sheets.map((sheet) => ({ file, sheet })))[0];
      if (firstProfiledSheet) setSelectedWorkbookSheet(`uploaded:${firstProfiledSheet.file.id}:${firstProfiledSheet.sheet.name}`);
      setWorkbookPage(1);
      setWorkbookPreviewTab("standardised");
      setWorkbookData(null);
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
      } catch (reviewError) {
        setAiReviewState("failed");
        setUploadError(reviewError.message);
      }
    } catch (error) {
      setUploadState("failed");
      setUploadProgress(0);
      setUploadError(error.message);
    }
  };

  const handleUploadChange = (event) => {
    uploadFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    uploadFiles(event.dataTransfer.files);
  };

  const saveCleanedData = async () => {
    if (!uploadedBatch || saveState === "saving") return;
    setSaveState("saving");
    try {
      const response = await fetch(`/api/upload-batches/${encodeURIComponent(uploadedBatch.batch.id)}/save-cleaned`, { method: "POST", headers: { Authorization: `Bearer ${getAccessToken()}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Cleaned data could not be saved");
      setUploadedBatch((current) => ({ ...current, batch: { ...current.batch, ...payload.batch } }));
      setSaveState("saved");
    } catch (error) {
      setSaveState("failed");
    }
  };

  const exportCleanedData = async () => {
    if (!uploadedBatch) return;
    try {
      const response = await fetch(`/api/upload-batches/${encodeURIComponent(uploadedBatch.batch.id)}/export?format=${encodeURIComponent(exportFormat)}&file_id=${encodeURIComponent(workbookSheet.fileId || "")}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
      if (!response.ok) throw new Error("Cleaned data could not be exported");
      const downloadUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `cleaned-upload.${exportFormat}`;
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
    }
    catch (error) { setPublishState("failed"); setUploadError(error.message); }
  };

  return (
    <section className="view active it-data-workspace">
      <header className="it-workspace-heading">
        <p className="eyebrow">IT data basis</p>
        <h3>IT Data Flow</h3>
        <p>Follow customer feedback from source files to business-ready reporting data.</p>
      </header>

      <div className="batch-intake-layout">
        <section
          className={`batch-intake-surface${uploadedBatch ? "" : " batch-intake-surface--empty"}${isDragActive ? " drag-active" : ""}`}
          aria-label="Upload source files"
          onDragEnter={(event) => {
            event.preventDefault();
            dragDepthRef.current += 1;
            setIsDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepthRef.current -= 1;
            if (dragDepthRef.current <= 0) {
              dragDepthRef.current = 0;
              setIsDragActive(false);
            }
          }}
          onDrop={handleDrop}
        >
          <div className="upload-intake-details">
            <strong>Upload a source batch</strong>
            <small>{isDragActive ? "Release to upload" : "Drop files here or choose files."}</small>
            <div className="upload-formats" aria-label="Accepted file formats">
              <span className="format-label">Formats</span>
              {summary.acceptedFormats.map((format) => (
                <span key={format}>{format.toUpperCase()}</span>
              ))}
            </div>
            <span className="upload-drop-indicator" aria-hidden="true">+</span>
            <label className="primary-button upload-button" htmlFor="itDataFlowUpload">Choose files</label>
          </div>
          <input
            id="itDataFlowUpload"
            className="sr-only"
            type="file"
            accept=".xlsx,.xls,.csv,.txt,.pdf,.doc,.docx"
            multiple
            onChange={handleUploadChange}
          />
          {uploadState === "uploading" || uploadedBatch ? (
            <div className={`upload-progress${uploadState === "uploaded" ? " complete" : ""}`} role="status">
              <div>
                <span>{uploadProgressLabel}</span>
                <strong>{uploadState === "uploaded" ? "100%" : `${uploadProgress}%`}</strong>
              </div>
              <span className="upload-progress-track" aria-hidden="true">
                <i style={{ width: `${uploadState === "uploaded" ? 100 : uploadProgress}%` }} />
              </span>
            </div>
          ) : null}
          {uploadError ? <p className="upload-error" role="alert">{uploadError}</p> : null}
          {uploadedBatch?.batch?.version ? <p className="upload-version">Pipeline version: {uploadedBatch.batch.version}</p> : null}
        </section>

      </div>

      {uploadedBatch ? <ol className="batch-lifecycle" aria-label="IT Data Flow lifecycle">
        {lifecycleStages.map((stage, index) => <li key={stage.key} className={stage.state}>
          <span>{index + 1}</span><div><strong>{stage.label}</strong><small>{stage.detail}</small></div>
        </li>)}
      </ol> : null}

      {uploadedBatch ? (
        <section className="ai-review-result" aria-live="polite" aria-labelledby="aiReviewTitle">
          <p className="eyebrow">MIA summary</p>
          <h4 id="aiReviewTitle">What the uploaded data shows</h4>
          {aiReviewState === "loading" ? <div className="review-progress" role="status"><div><span>Preparing business summary</span><strong>{reviewElapsedSeconds}s</strong></div><i aria-hidden="true" /></div> : null}
          {aiReviewState === "failed" ? <p>A business summary is not available for this upload.</p> : null}
          {aiReview ? <>
            <div className="ai-review-findings ai-business-review">
              <article className="business-overview-panel">
                <h5>Dataset Overview</h5>
                <dl className="dataset-overview-grid">
                  <div><dt>Records</dt><dd>{datasetOverview.recordCount.toLocaleString()}</dd></div>
                  <div><dt>Data sources</dt><dd>{datasetOverview.dataSources.join(", ") || "Not identified"}</dd></div>
                  <div><dt>Time period</dt><dd>{datasetOverview.timePeriod}</dd></div>
                  <div><dt>Countries</dt><dd>{datasetOverview.countries.join(", ") || "Not identified"}</dd></div>
                  <div><dt>Routes</dt><dd>{datasetOverview.routes.join(", ") || "Not identified"}</dd></div>
                  <div><dt>Languages</dt><dd>{datasetOverview.languages.join(", ") || "Not identified"}</dd></div>
                </dl>
                <h5>Main Business Topics</h5>
                <div className="business-topic-groups">
                  <div><strong>Customer themes</strong><p>{businessReview.mainBusinessTopics.customerThemes.join(" · ") || "Not identified"}</p></div>
                  <div><strong>Service areas</strong><p>{businessReview.mainBusinessTopics.serviceAreas.join(" · ") || "Not identified"}</p></div>
                  <div><strong>Operations</strong><p>{businessReview.mainBusinessTopics.operations.join(" · ") || "Not identified"}</p></div>
                </div>
                <h5>Dataset Summary</h5>
                <p className="ai-review-summary">{businessReview.datasetSummary}</p>
              </article>
              <article className="key-insights-panel">
                <h5>Key Insights</h5>
                {businessReview.keyInsights.length ? <div className="key-insight-grid">{businessReview.keyInsights.map((insight) => <section key={`${insight.title}-${insight.detail}`} className="key-insight-card"><strong>{insight.title}</strong><p>{insight.detail}</p></section>)}</div> : <p>No key business insights were identified from the uploaded rows.</p>}
              </article>
            </div>
          </> : null}
        </section>
      ) : null}

      {uploadedBatch ? <section className="workbook-preview-panel" aria-labelledby="workbookPreviewTitle">
        <div className="workbook-preview-header">
          <div>
            <p className="eyebrow">Source workbook preview</p>
            <h4 id="workbookPreviewTitle">Cleaned uploaded data</h4>
          </div>
          <div className="cleaned-data-actions">
            <button className="text-button" type="button" onClick={saveCleanedData} disabled={saveState === "saving" || publishState === "published"}>
              {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : "Save cleaned data"}
            </button>
            <button className="primary-button" type="button" onClick={publishToInsights} disabled={saveState !== "saved" || publishState === "publishing"}>{publishState === "published" ? "Published" : publishState === "publishing" ? "Publishing..." : "Publish to Insights"}</button>
            {publishState === "published" ? <button className="text-button" type="button" onClick={() => navigate(`/overview?datasetRun=${encodeURIComponent(uploadedBatch.batch.id)}`)}>View insights</button> : null}
            <label>
              <span className="sr-only">Export format</span>
              <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}>
                <option value="xlsx">Excel</option>
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
            </label>
            <button className="text-button" type="button" onClick={exportCleanedData}>Export</button>
          </div>
        </div>
        <p className="panel-note">
          Select an uploaded worksheet to review its cleaned columns and rows. Dates and times use UTC ISO-8601. Identity values are masked in this business preview.
        </p>
        <section className="cleaning-outcome" aria-label="Cleaning outcome">
          <div><strong>Cleaning outcome</strong><small>{cleaningOutcome.receivedRows.toLocaleString()} received / {cleaningOutcome.cleanedRows.toLocaleString()} retained</small></div>
          <dl>
            <div><dt>Blank rows removed</dt><dd>{cleaningOutcome.blankRowsRemoved.toLocaleString()}</dd></div>
            <div><dt>Duplicate rows removed</dt><dd>{cleaningOutcome.duplicateRowsRemoved.toLocaleString()}</dd></div>
            <div><dt>Missing values standardized</dt><dd>{cleaningOutcome.missingValuesStandardized.toLocaleString()}</dd></div>
            <div><dt>Business values mapped</dt><dd>{cleaningOutcome.mappedValues.toLocaleString()}</dd></div>
            <div><dt>Mapping exceptions</dt><dd>{cleaningOutcome.mappingExceptions.toLocaleString()}</dd></div>
          </dl>
        </section>
        <section className="quality-self-check" aria-label="Data quality self-check">
          <div><strong>Data quality self-check</strong><small>Items below remain traceable for review; they are not silently treated as clean.</small></div>
          <dl>
            <div><dt>Invalid dates</dt><dd>{cleaningOutcome.invalidDateValues.toLocaleString()}</dd></div>
            <div><dt>Invalid amounts</dt><dd>{cleaningOutcome.invalidAmountValues.toLocaleString()}</dd></div>
            <div><dt>Invalid ratings</dt><dd>{cleaningOutcome.invalidRatingValues.toLocaleString()}</dd></div>
            <div><dt>Unmapped routes</dt><dd>{cleaningOutcome.unmappedRouteValues.toLocaleString()}</dd></div>
            <div><dt>Enum exceptions</dt><dd>{cleaningOutcome.enumExceptions.toLocaleString()}</dd></div>
            <div><dt>Missing identifiers</dt><dd>{cleaningOutcome.missingKeyValues.toLocaleString()}</dd></div>
            <div><dt>Duplicate identifiers</dt><dd>{cleaningOutcome.duplicateKeyValues.toLocaleString()}</dd></div>
            <div><dt>Mixed age formats</dt><dd>{cleaningOutcome.mixedAgeFormats.toLocaleString()}</dd></div>
            <div><dt>Ambiguous reference fields</dt><dd>{cleaningOutcome.ambiguousReferenceColumns.toLocaleString()}</dd></div>
          </dl>
        </section>
        <div className="workbook-tabs" role="tablist" aria-label="Source workbook worksheets">
          {workbookSheets.map((item) => (
            <button
              key={item.key}
              className={item.key === workbookSheet.key ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={item.key === workbookSheet.key}
              onClick={() => {
                setSelectedWorkbookSheet(item.key);
                setWorkbookPage(1);
                setWorkbookData(null);
              }}
            >
              <strong>{item.sheet}</strong>
              <small>{item.rowCount} rows</small>
            </button>
          ))}
        </div>
        <div className="workbook-tabs survey-preview-tabs" role="tablist" aria-label="Source workbook preview views">
          {[['standardised', 'Standardised data'], ['exceptions', 'Exceptions']].map(([key, label]) => (
            <button key={key} className={workbookPreviewTab === key ? "active" : ""} type="button" role="tab" aria-selected={workbookPreviewTab === key} onClick={() => setWorkbookPreviewTab(key)}><strong>{label}</strong></button>
          ))}
        </div>
        {workbookPreviewTab === "standardised" ? <>
          <div className="worksheet-context">
            <span>{workbookSheet.source}</span>
            <strong>{workbookSheet.sheet}</strong>
            <small>{workbookColumns.length} fields / {workbookTotalRows} cleaned rows</small>
          </div>
          {workbookLoadError ? <p className="workbook-load-error">{workbookLoadError}</p> : null}
          <DataTable columns={workbookColumns} rows={displayedWorkbookRows} />
          <div className="workbook-pagination" aria-label="Source worksheet pagination">
            <label>
              Rows per page
              <select value={workbookPageSize} onChange={(event) => {
                setWorkbookPageSize(Number(event.target.value));
                setWorkbookPage(1);
              }}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <span>Page {workbookPage} of {workbookTotalPages}</span>
            <button className="text-button" type="button" disabled={workbookPage === 1} onClick={() => setWorkbookPage((page) => page - 1)}>Previous</button>
            <button className="text-button" type="button" disabled={workbookPage === workbookTotalPages} onClick={() => setWorkbookPage((page) => page + 1)}>Next</button>
          </div>
        </> : workbookExceptions.length ? <><div className="survey-mapping-list" role="table">
          {workbookExceptions.map((exception) => <div className="survey-mapping-row" role="row" key={exception.key}><strong>{exception.sheet}</strong><span>{exception.source} · Values could not be mapped to the data standard.</span><small>{exception.count} rows</small><button className="text-button" type="button" onClick={() => setExceptionSheetKey(exception.key)}>{exceptionSheetKey === exception.key ? "Reviewing rows" : "Review rows"}</button></div>)}
        </div>{exceptionSheetKey ? <ExceptionRowReview batchId={uploadedBatch.batch.id} fileId={workbookExceptions.find((item) => item.key === exceptionSheetKey)?.fileId} sheetName={workbookExceptions.find((item) => item.key === exceptionSheetKey)?.sheet} /> : null}</> : <p className="panel-note">No mapping exceptions were found in this uploaded data.</p>}
      </section> : null}

    </section>
  );
}

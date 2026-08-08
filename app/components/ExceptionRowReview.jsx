import React, { useEffect, useState } from "react";
import { DataTable } from "./common.jsx";
import { getAccessToken } from "../lib/auth.js";

function reviewRows(data) {
  return (data?.rows || []).map((row, index) => ({
    "Exception details": <span className="exception-detail-list">{(row.exceptionDetails || []).map((detail) => <span className="exception-detail" key={`${detail.field}-${detail.value}`}><span>{detail.field}: </span><span className="exception-metric-value">{detail.value}</span><span> ({detail.reason})</span></span>)}</span>,
    ...Object.fromEntries((data.columns || []).map((column) => [column, row[column] == null || row[column] === "" ? <span className="missing-value">null</span> : row[column]])),
    key: `exception-${index}`
  }));
}

export function ExceptionRowReview({ batchId, fileId, sheetName }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [batchId, fileId, sheetName]);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    fetch(`/api/upload-batches/${encodeURIComponent(batchId)}/sheets?file_id=${encodeURIComponent(fileId)}&sheet=${encodeURIComponent(sheetName)}&page=${page}&page_size=100&exceptions_only=true`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${getAccessToken()}` }
    })
      .then((response) => {
        if (!response.ok) throw new Error("Exception rows could not be loaded");
        return response.json();
      })
      .then(setData)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError("Exception rows could not be loaded.");
      });
    return () => controller.abort();
  }, [batchId, fileId, page, sheetName]);

  return <section className="exception-row-review" aria-live="polite">
    <h5>Exception rows</h5>
    {error ? <p className="workbook-load-error">{error}</p> : null}
    {!data && !error ? <p className="panel-note">Loading exception rows...</p> : null}
    {data ? <><p className="panel-note">{data.totalRows} affected row{data.totalRows === 1 ? "" : "s"}. Restricted fields remain masked.</p><DataTable columns={["Exception details", ...data.columns]} rows={reviewRows(data)} /><div className="workbook-pagination" aria-label="Exception row pagination"><span>Page {data.page} of {data.totalPages}</span><button className="text-button" type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="text-button" type="button" disabled={page === data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></> : null}
  </section>;
}

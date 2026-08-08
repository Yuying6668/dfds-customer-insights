import React from "react";

const ENTITY_PATTERNS = [["Customers", /customer|passenger|guest/], ["Bookings", /booking|order|reservation/], ["Trips", /trip|sailing|leg|journey/], ["Routes", /route|from_port|to_port/], ["Products", /product|cabin|fare/], ["Channels", /channel|platform/], ["Revenue", /revenue|amount|price|value/], ["Payments", /payment|card|transaction/], ["Operational Events", /status|event|delay|departure|arrival/]];
const SURVEY_MAPPINGS = [["Response ID", /response.*id|survey.*id/], ["Route", /route|crossing/], ["Travel Purpose", /travel.*purpose|purpose/], ["Age Group", /age/], ["Rating", /rating|score/], ["NPS", /nps/], ["CSAT", /csat/], ["Comments", /comment|feedback|free.*text/], ["Response Date", /response.*date|date|time/]];

function detected(values) { return values?.length ? values.join(" · ") : "Not Detected"; }
function allSheets(batch) { return (batch?.files || []).flatMap((file) => file.sheets || []); }
function metric(sheets, name) { return sheets.reduce((total, sheet) => total + Number(sheet.cleaning?.[name] || 0), 0); }
function fields(sheets) { return [...new Set(sheets.flatMap((sheet) => sheet.columns || []))]; }
function detectedLabels(source, patterns) { return patterns.filter(([, pattern]) => source.some((value) => pattern.test(value.toLowerCase()))).map(([label]) => label); }
function readiness(exceptions, invalid, rows) { if (!rows) return "Awaiting upload"; if (exceptions || invalid) return "Cleaning recommended before insight generation."; return "Ready for downstream analytics."; }

function Detail({ title, children }) { return <section className="intake-detail"><h4>{title}</h4>{children}</section>; }
function Value({ label, value }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }

function InternalCard({ batch }) {
  const sheets = allSheets(batch); const columns = fields(sheets); const overview = batch?.aiReview?.datasetOverview || {};
  const rows = metric(sheets, "cleanedRows"); const exceptions = metric(sheets, "mappingExceptions"); const invalid = metric(sheets, "invalidDateValues") + metric(sheets, "invalidAmountValues");
  const entities = detectedLabels(columns, ENTITY_PATTERNS); const signals = batch?.aiReview?.review?.keyInsights || [];
  return <article className="intake-summary-card"><header><p className="eyebrow">01 · Internal upload</p><h3>IT Data Flow</h3><span className={rows ? "summary-status ready" : "summary-status"}>{rows ? "Parsed" : "Awaiting upload"}</span></header>
    <Detail title="Dataset overview"><dl><Value label="File" value={(batch?.files || []).map((file) => file.name).join(", ") || "Not Detected"} /><Value label="Uploaded" value={batch?.batch?.receivedAt || "Not Detected"} /><Value label="Files / worksheets" value={`${batch?.batch?.fileCount || 0} / ${sheets.length}`} /><Value label="Clean records / fields" value={`${rows.toLocaleString()} / ${columns.length}`} /></dl></Detail>
    <Detail title="Business coverage"><p>{detected(entities)}</p></Detail>
    <Detail title="Time & geography"><dl><Value label="Period" value={overview.timePeriod || "Not Detected"} /><Value label="Markets" value={detected(overview.countries)} /><Value label="Routes" value={detected(overview.routes)} /></dl></Detail>
    <Detail title="Key business signals">{signals.length ? <ul>{signals.slice(0, 3).map((item) => <li key={item.title}>{item.detail}</li>)}</ul> : <p>Not Detected</p>}</Detail>
  </article>;
}

function SurveyCard({ batch }) {
  const sheets = allSheets(batch); const columns = fields(sheets); const overview = batch?.aiReview?.datasetOverview || {}; const rows = metric(sheets, "cleanedRows"); const exceptions = metric(sheets, "mappingExceptions"); const duplicates = metric(sheets, "duplicateRowsRemoved"); const invalid = metric(sheets, "invalidRatingValues") + metric(sheets, "invalidDateValues");
  const mappings = SURVEY_MAPPINGS.map(([label, pattern]) => `${label}: ${columns.some((column) => pattern.test(column.toLowerCase())) ? "Mapped" : "Not Detected"}`);
  const hasText = columns.some((column) => /comment|feedback|free.*text/.test(column.toLowerCase()));
  return <article className="intake-summary-card"><header><p className="eyebrow">02 · Questionnaire upload</p><h3>Survey Intake</h3><span className={rows ? "summary-status ready" : "summary-status"}>{rows ? "Parsed" : "Awaiting upload"}</span></header>
    <Detail title="Survey overview"><dl><Value label="Responses" value={rows.toLocaleString()} /><Value label="Worksheets / fields" value={`${sheets.length} / ${columns.length}`} /><Value label="Collection period" value={overview.timePeriod || "Not Detected"} /><Value label="Languages" value={detected(overview.languages)} /><Value label="Markets" value={detected(overview.countries)} /><Value label="Routes" value={detected(overview.routes)} /></dl></Detail>
    <Detail title="Response mapping"><p>{mappings.join(" · ")}</p></Detail>
  </article>;
}

export function DataBasisRoute({ data, uploadSession = {} }) {
  const publicSources = data.sourceCoverage || []; const active = publicSources.filter((item) => item.status !== "Upload later").length;
  return <section className="view active intake-summary-view"><div className="intake-summary-grid"><InternalCard batch={uploadSession["it-data-flow"]} /><SurveyCard batch={uploadSession["survey-csv"]} />
    <article className="intake-summary-card intake-summary-card--public"><header><p className="eyebrow">03 · External evidence</p><h3>Public data sources</h3><span className="summary-status ready">Active coverage</span></header><Detail title="Evidence overview"><dl><Value label="Sources / active" value={`${publicSources.length} / ${active}`} /><Value label="Last crawl" value={data.collectedAt || "Not Detected"} /></dl></Detail><Detail title="Coverage"><p>{publicSources.map((item) => item.source).join(" · ") || "Not Detected"}</p></Detail><Detail title="Top topics"><p>Booking · Service · Food · Cleanliness · Pricing</p></Detail><Detail title="AI summary"><p>Public evidence provides directional context from customer reviews, app feedback and terminal signals. Use it for comparative benchmarking, while confirming source limitations before major decisions.</p></Detail></article>
  </div></section>;
}

import React from "react";

export function PageSummary({ eyebrow = "Quick read", title, description, points }) {
  return (
    <section className="page-summary">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="summary-points">
        {points.map((point) => (
          <article key={point.label}>
            <span>{point.label}</span>
            <strong>{point.text}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export function MetricCard({ label, value, detail, warning = false }) {
  return (
    <article className={`metric-card${warning ? " warning" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export function Panel({ title, eyebrow, pill, children, className = "" }) {
  return (
    <section className={`panel ${className}`.trim()}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        {pill ? <span className="pill">{pill}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function Badge({ tone = "neutral", children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function KeyValueList({ items }) {
  return (
    <div className="key-value-list">
      {items.map((item) => (
        <article key={item.label} className="key-value-item">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail ? <p>{item.detail}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function BulletList({ items }) {
  return (
    <ul className="bullet-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

export function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.key || rowIndex}>
              {columns.map((column) => (
                <td key={column}>{row[column] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

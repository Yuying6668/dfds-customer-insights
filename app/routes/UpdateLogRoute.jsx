import React from "react";
import { Panel, PageSummary } from "../components/common.jsx";

export function UpdateLogRoute({ data }) {
  const [showOlderLogs, setShowOlderLogs] = React.useState(false);
  const visibleLogs = data.supervisorLogs.slice(0, 10);
  const olderLogs = data.supervisorLogs.slice(10);

  return (
    <section className="view active">
      <PageSummary
        title="What changed in the product"
        description="This page keeps the product change history close to the dashboard so the team can see how the report evolved."
        points={[
          { label: "Look first", text: "The newest entries at the top." },
          { label: "Watch for", text: "Log entries that explain route, chat, or release changes." },
          { label: "Use it for", text: "Understanding why the dashboard looks the way it does." }
        ]}
      />

      <Panel title="Project update timeline" eyebrow="Update Log">
        <div className="update-log-list">
          {visibleLogs.map((item) => (
            <article key={`${item.time}-${item.module}`} className="timeline-card">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">{item.time}</p>
                  <h3>{item.module}</h3>
                </div>
                <span className="pill">{item.status}</span>
              </div>
              <p>{item.change}</p>
              <small>{item.result}</small>
            </article>
          ))}
          {olderLogs.length ? (
            <section className={`update-log-archive${showOlderLogs ? " expanded" : ""}`}>
              <button
                className="update-log-toggle"
                type="button"
                aria-expanded={showOlderLogs}
                onClick={() => setShowOlderLogs((current) => !current)}
              >
                {showOlderLogs ? "Hide older logs" : "Show older logs"} ({olderLogs.length})
              </button>
              {showOlderLogs ? (
                <div className="update-log-archive-list">
                  {olderLogs.map((item) => (
                    <article key={`${item.time}-${item.module}`} className="timeline-card">
                      <div className="panel-header">
                        <div>
                          <p className="eyebrow">{item.time}</p>
                          <h3>{item.module}</h3>
                        </div>
                        <span className="pill">{item.status}</span>
                      </div>
                      <p>{item.change}</p>
                      <small>{item.result}</small>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </Panel>
    </section>
  );
}

import React from "react";
import { Panel, PageSummary } from "../components/common.jsx";

export function AppReviewsRoute({ data }) {
  return (
    <section className="view active">
      <PageSummary
        title="Check if the app is helping customers"
        description="This page shows how people rate the DFDS Passenger app and what they struggle with before or during their trip."
        points={[
          { label: "Look first", text: "Compare Android and iOS ratings." },
          { label: "Watch for", text: "Login, booking, ticket, and route-information issues." },
          { label: "Use it for", text: "Deciding what must improve before pushing app self-service harder." }
        ]}
      />

      <Panel title="DFDS Passenger app intelligence" eyebrow="Mobile app reviews" pill="Apple + Android">
        <div className="store-grid">
          {data.appStores.map((store) => (
            <article key={store.platform} className="app-store-card">
              <div className="app-store-top">
                <div className="store-heading">
                  <img className="store-logo" src={store.logo} alt={`${store.platform} logo`} />
                  <div>
                    <h4>{store.platform}</h4>
                    <p>
                      {store.app} · {store.package}
                    </p>
                  </div>
                </div>
                <div className="app-score compact">
                  <strong>{store.rating}</strong>
                  <span>{store.reviewCount}</span>
                </div>
              </div>
              <div className="app-store-actions">
                <span className="pill">{store.status}</span>
                <a href={store.url} target="_blank" rel="noreferrer">
                  Open {store.platform}
                </a>
              </div>
              <p>{store.summary}</p>
            </article>
          ))}
        </div>

        <div className="evidence-stack">
          {data.appReviewEvidence.map((item) => (
            <article key={`${item.date}-${item.title}`} className="app-evidence-card">
              <div className="item-top">
                <div>
                  <h4>{item.title}</h4>
                  <p>
                    {item.platform} · {item.date} · {item.rating}
                  </p>
                </div>
                <span className={`pill ${item.rating.startsWith("1") ? "high" : ""}`}>{item.theme}</span>
              </div>
              <p>
                <strong>Evidence:</strong> {item.evidence}
              </p>
              <p>
                <strong>Business meaning:</strong> {item.businessMeaning}
              </p>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

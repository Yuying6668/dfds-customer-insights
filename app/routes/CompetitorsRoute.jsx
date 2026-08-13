import React, { useMemo, useState } from "react";
import { BulletList, Panel, PageSummary } from "../components/common.jsx";
import { UploadedInsightPanel } from "../components/UploadedInsightPanel.jsx";
import { UploadedInsightView } from "../components/UploadedInsightView.jsx";
import { useDatasetInsight } from "../hooks/use-dataset-insight.mjs";

function parseReviewCount(value) {
  const match = String(value || "").replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function scoreText(score) {
  return score === "Pending public review check" ? "Score not collected" : `${score} / 5`;
}

function displayCompanyName(company) {
  return company === "DFDS" ? "Mia's Cruises" : company;
}

function displayCompetitorText(text) {
  return String(text).replace(/DFDS/g, "Mia's Cruises");
}

export function CompetitorsRoute({ data }) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("default");
  const { analytics, loading, supported } = useDatasetInsight("competitors");
  const rows = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const baseline = data.competitors.find((item) => item.company === "DFDS");
    const competitors = data.competitors
      .filter((item) => item.company !== "DFDS")
      .filter((item) => {
        if (!query) return true;
        return [item.company, item.category, item.userView, item.routes, item.overlap, item.learning]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (sort === "score-desc") return (Number(b.score) || -1) - (Number(a.score) || -1);
        if (sort === "score-asc") return (Number(a.score) || 99) - (Number(b.score) || 99);
        if (sort === "reviews-desc") return (parseReviewCount(b.reviews) || -1) - (parseReviewCount(a.reviews) || -1);
        if (sort === "reviews-asc") return (parseReviewCount(a.reviews) || 999999999) - (parseReviewCount(b.reviews) || 999999999);
        if (sort === "name-asc") return a.company.localeCompare(b.company);
        return 0;
      });

    return baseline ? [baseline, ...competitors] : competitors;
  }, [data.competitors, filter, sort]);

  if (loading) return <section className="view active"><PageSummary title="Uploaded data is processing" description="Competitor context will refresh when the published analysis is ready." points={[]} /></section>;
  if (supported && analytics) return <UploadedInsightView analytics={analytics} title="Competitor market signals" description="Uploaded market and rating indicators are" />;

  return (
    <section className="view active">
      <PageSummary
        title="See how Mia's Cruises compares with other ferry brands"
        description="This page shows which ferry companies matter for comparison, how customers rate them, and where their routes overlap with Mia's Cruises."
        points={[
          { label: "Look first", text: "Start with Mia's Cruises, then compare the other rows against it." },
          { label: "Watch for", text: "Ratings, review volume, overlapping routes, and useful ideas." },
          { label: "Use it for", text: "Finding the strongest external benchmark for each market." }
        ]}
      />

      <Panel title="Competitor scope" eyebrow="Benchmark context" pill="12 ferry brands">
        <BulletList items={data.competitorScope.bullets.map(displayCompetitorText)} />
      </Panel>

      <Panel title="Ferry benchmark table" eyebrow="Competitors">
        <div className="table-tools">
          <label htmlFor="benchmarkFilter">Filter</label>
          <input
            id="benchmarkFilter"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search company or route"
          />
          <label htmlFor="competitorSort">Sort</label>
          <select id="competitorSort" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="default">Default order</option>
            <option value="score-desc">Score high to low</option>
            <option value="score-asc">Score low to high</option>
            <option value="reviews-desc">Reviews high to low</option>
            <option value="reviews-asc">Reviews low to high</option>
            <option value="name-asc">Name A to Z</option>
          </select>
        </div>

        <div className="benchmark-table">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Role in comparison</th>
                <th>Score</th>
                <th>Reviews</th>
                <th>Customer view</th>
                <th>Main routes</th>
                <th>Overlap with Mia's Cruises</th>
                <th>What Mia's Cruises can learn</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.company} className={row.company === "DFDS" ? "baseline-row" : ""}>
                  <td>
                    <strong>{displayCompanyName(row.company)}</strong>
                  </td>
                  <td>{displayCompetitorText(row.category)}</td>
                  <td className="score">{scoreText(row.score)}</td>
                  <td>{row.reviews}</td>
                  <td>{displayCompetitorText(row.userView)}</td>
                  <td>{displayCompetitorText(row.routes)}</td>
                  <td>{displayCompetitorText(row.overlap)}</td>
                  <td>{displayCompetitorText(row.learning)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}

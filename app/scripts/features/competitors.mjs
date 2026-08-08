import { dfdsIntelligenceData as data } from "../../data/index.mjs";
import { $ } from "../core/dom.mjs";
import { parseReviewCount } from "../utils/format.mjs";

export function getCompetitorRows() {
  const baseline = data.competitors.find((row) => row.company === "DFDS");
  const competitors = data.competitors.filter((row) => row.company !== "DFDS");
  const sort = $("#competitorSort")?.value || "default";

  const sorted = [...competitors].sort((a, b) => {
    if (sort === "score-desc") return (Number(b.score) || -1) - (Number(a.score) || -1);
    if (sort === "score-asc") return (Number(a.score) || 99) - (Number(b.score) || 99);
    if (sort === "reviews-desc") return (parseReviewCount(b.reviews) || -1) - (parseReviewCount(a.reviews) || -1);
    if (sort === "reviews-asc") return (parseReviewCount(a.reviews) || 999999999) - (parseReviewCount(b.reviews) || 999999999);
    if (sort === "name-asc") return a.company.localeCompare(b.company);
    return 0;
  });

  return baseline ? [baseline, ...sorted] : sorted;
}

export function renderCompetitorTable() {
  const table = $("#benchmarkTable");
  const rows = getCompetitorRows();

  table.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Company</th>
          <th>Role in comparison</th>
          <th>Score</th>
          <th>Reviews</th>
          <th>Customer view</th>
          <th>Main routes</th>
          <th>Overlap with DFDS</th>
          <th>What DFDS can learn</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr class="${row.company === "DFDS" ? "baseline-row" : ""}">
                <td><strong>${row.company}</strong></td>
                <td>${row.category}</td>
                <td class="score">${row.score === "Pending public review check" ? "Score not collected" : `${row.score} / 5`}</td>
                <td>${row.reviews}</td>
                <td>${row.userView}</td>
                <td>${row.routes}</td>
                <td>${row.overlap}</td>
                <td>${row.learning}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function renderBenchmark() {
  $("#competitorScope").innerHTML = `
    <strong>${data.competitorScope.title}</strong>
    <ul>
      ${data.competitorScope.bullets.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
  renderCompetitorTable();
}

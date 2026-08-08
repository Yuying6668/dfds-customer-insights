import { dfdsIntelligenceData as data } from "../../data/index.mjs";
import { $ } from "../core/dom.mjs";

export function renderUpdateLog() {
  const list = $("#supervisorList");
  list.innerHTML = [...data.supervisorLogs]
    .sort((a, b) => b.time.localeCompare(a.time))
    .map(
      (log) => `
        <article class="supervisor-item">
          <div class="item-top">
            <div>
              <h4>${log.module}</h4>
              <p>${log.time}</p>
            </div>
            <span class="pill">${log.status}</span>
          </div>
          <p><strong>Change:</strong> ${log.change}</p>
          <p><strong>Reason:</strong> ${log.reason}</p>
          <p><strong>Scope:</strong> ${log.scope}</p>
          <p><strong>Result:</strong> ${log.result}</p>
        </article>
      `
    )
    .join("");
}

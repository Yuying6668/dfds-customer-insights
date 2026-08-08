import { dfdsIntelligenceData as data } from "../../data/index.mjs";
import { $ } from "../core/dom.mjs";

export function renderSources() {
  const list = $("#sourceList");
  list.innerHTML = data.sources
    .map(
      (source) => `
        <article class="source-item">
          <div class="item-top">
            <h4>${source.title}</h4>
            <a href="${source.url}" target="_blank" rel="noreferrer">Open source</a>
          </div>
          <p>${source.note}</p>
        </article>
      `
    )
    .join("");
}

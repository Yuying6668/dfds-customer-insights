import { $, $$ } from "../core/dom.mjs";
import { routeDrivenViews } from "../core/state.mjs";

export function bindNavigation() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".nav-item").forEach((item) => item.classList.remove("active"));
      $$(".view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      $(`#${button.dataset.view}`).classList.add("active");
      $("#routeControl").classList.toggle("hidden", !routeDrivenViews.has(button.dataset.view));
    });
  });
}

export function bindRouteFilter(onRouteChange) {
  $("#routeFilter").addEventListener("change", (event) => {
    onRouteChange(event.target.value);
  });
}

export function bindCompetitorSort(onSortChange) {
  $("#competitorSort")?.addEventListener("change", onSortChange);
}

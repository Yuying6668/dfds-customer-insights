import { $ } from "./dom.mjs";

export const routeDrivenViews = new Set(["overview", "feedback", "recommendations"]);

export function getActiveView() {
  return $(".view.active")?.id || "overview";
}

export function getSelectedRoute() {
  return $("#routeFilter")?.value || "all";
}

export const routeConfig = [
  { path: "/agent-control", view: "agent-control", label: "Agent Control", hidden: true },
  { path: "/it-data-flow", view: "it-data-flow", label: "IT Data Flow", group: "Data Intake" },
  { path: "/survey-csv", view: "survey-csv", label: "Survey Intake", group: "Data Intake" },
  { path: "/data-basis", view: "data-basis", label: "Data Intake Summary", group: "Data Intake" },
  { path: "/customer-voice", view: "customer-voice", label: "Customer Voice", group: "Data Insights" },
  { path: "/app-reviews", view: "app-reviews", label: "App Reviews", group: "Data Insights" },
  { path: "/passenger-profile", view: "passenger-profile", label: "Passenger Profile", group: "Data Insights" },
  { path: "/competitors", view: "competitors", label: "Competitors", group: "Data Insights" },
  { path: "/overview", view: "overview", label: "Overview", group: "Business Decisions" },
  { path: "/recommendations", view: "recommendations", label: "Recommendations", group: "Business Decisions" },
  { path: "/review-console", view: "review-console", label: "Review Console", group: "Governance & Operations" },
  { path: "/update-log", view: "update-log", label: "Update Log", group: "Governance & Operations" }
];

export const navigationGroups = ["Data Intake", "Data Insights", "Business Decisions", "Governance & Operations"];

export const routeFocusOptions = [
  { value: "all", label: "All signals" },
  { value: "dover-calais", label: "Dover-Calais" },
  { value: "newhaven-dieppe", label: "Newhaven-Dieppe" },
  { value: "newcastle-ijmuiden", label: "Newcastle-IJmuiden" },
  { value: "jersey", label: "Jersey / Channel Islands" }
];

export function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return routeConfig.some((route) => route.path === pathname) ? pathname : "/overview";
}

export function normalizedPathWithSearch(pathname, search = "") {
  return `${normalizePath(pathname)}${search || ""}`;
}

export function getRouteLabel(pathname) {
  return routeConfig.find((route) => route.path === pathname)?.label || "Overview";
}

export function getRouteView(pathname) {
  return routeConfig.find((route) => route.path === pathname)?.view || "overview";
}

export function isRouteAware(pathname) {
  return ["/overview", "/passenger-profile", "/customer-voice", "/recommendations", "/review-console"].includes(pathname);
}

export function buildPageBrief({ pathname, routeFocus, title, summary }) {
  return [
    `Page: ${title}`,
    `Route focus: ${routeFocus}`,
    summary,
    `Open route: ${pathname}`
  ].join("\n");
}

export function navigate(pathname) {
  const target = new URL(pathname, window.location.href);
  const current = new URL(window.location.href);
  if (!target.searchParams.has("datasetRun") && current.searchParams.has("datasetRun")) {
    target.searchParams.set("datasetRun", current.searchParams.get("datasetRun"));
  }
  const destination = `${target.pathname}${target.search}`;
  if (`${current.pathname}${current.search}` !== destination) {
    window.history.pushState({}, "", destination);
    window.dispatchEvent(new Event("dfds:navigate"));
  }
}

export function useLocationState(React) {
  const { useEffect, useState } = React;
  const [pathname, setPathname] = useState(normalizePath(window.location.pathname));

  useEffect(() => {
    const onChange = () => setPathname(normalizePath(window.location.pathname));
    window.addEventListener("popstate", onChange);
    window.addEventListener("dfds:navigate", onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener("dfds:navigate", onChange);
    };
  }, []);

  return pathname;
}

import React, { useEffect, useMemo, useState } from "react";
import { dfdsIntelligenceData as data } from "./data/index.mjs";
import { Badge } from "./components/common.jsx";
import { PageSummary } from "./components/common.jsx";
import { ChatWidget } from "./components/chat-widget.jsx";
import { getAccessToken, loginPageUrl, requiresLogin } from "./lib/auth.js";
import { clearUploadSession, loadUploadSession, saveUploadSession } from "./lib/upload-session.mjs";
import { displayBrandText } from "./lib/brand-display.mjs";
import { buildPageBrief, getRouteLabel, isRouteAware, navigate, navigationGroups, normalizePath, routeConfig, routeFocusOptions, useLocationState } from "./lib/router.js";
import { OverviewRoute } from "./routes/OverviewRoute.jsx";
import { PassengerProfileRoute } from "./routes/PassengerProfileRoute.jsx";
import { CustomerVoiceRoute } from "./routes/CustomerVoiceRoute.jsx";
import { AppReviewsRoute } from "./routes/AppReviewsRoute.jsx";
import { CompetitorsRoute } from "./routes/CompetitorsRoute.jsx";
import { RecommendationsRoute } from "./routes/RecommendationsRoute.jsx";
import { SurveyCsvRoute } from "./routes/SurveyCsvRoute.jsx";
import { UpdateLogRoute } from "./routes/UpdateLogRoute.jsx";
import { DataBasisRoute } from "./routes/DataBasisRoute.jsx";
import { ITDataFlowRoute } from "./routes/ITDataFlowRoute.jsx";
import { ReviewConsoleRoute } from "./routes/ReviewConsoleRoute.jsx";
import { listDatasetRuns } from "./scripts/services/dataset-run-api.mjs";

const routeMap = {
  overview: OverviewRoute,
  "passenger-profile": PassengerProfileRoute,
  "customer-voice": CustomerVoiceRoute,
  "app-reviews": AppReviewsRoute,
  competitors: CompetitorsRoute,
  recommendations: RecommendationsRoute,
  "survey-csv": SurveyCsvRoute,
  "update-log": UpdateLogRoute,
  "data-basis": DataBasisRoute,
  "it-data-flow": ITDataFlowRoute,
  "review-console": ReviewConsoleRoute
};

function useRouteFocus() {
  const [routeFocus, setRouteFocus] = useState("all");
  return [routeFocus, setRouteFocus];
}

function activeViewFromPath(pathname) {
  return normalizePath(pathname).replace("/", "") || "overview";
}

function getRouteAwareSummary(pathname) {
  if (pathname === "/customer-voice") return "Route-specific customer themes, evidence, and marketing actions.";
  if (pathname === "/passenger-profile") return "Synthetic passenger profile slices by segment, route, travel context and product preference.";
  if (pathname === "/app-reviews") return "Mobile app evidence, ratings, and recurring travel friction.";
  if (pathname === "/competitors") return "Benchmark context for the ferry brands Mia's Cruises is compared against.";
  if (pathname === "/recommendations") return "Practical next steps tied to the public evidence base.";
  if (pathname === "/survey-csv") return "Survey questionnaire upload, standardisation checks, and MIA-ready evidence preview.";
  if (pathname === "/update-log") return "A simple timeline of product changes.";
  if (pathname === "/data-basis") return "Latest intake status, standardisation outcomes, and MIA-ready evidence.";
  if (pathname === "/it-data-flow") return "How uploaded files are cleaned, versioned, modeled, reviewed, and surfaced to Mia.";
  if (pathname === "/review-console") return "Internal supervision items and publish readiness checks.";
  return "Overview of public signals, route context, source coverage, and key risks.";
}

function LoginPage() {
  const [mode, setMode] = useState("login"); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const submit = async (event) => { event.preventDefault(); setError(""); setNotice(""); const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login"; try { const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Request failed"); if (mode === "register") { setMode("login"); setPassword(""); setNotice("Registration complete. Sign in with your new account."); return; } window.localStorage.setItem("dfds-access-token", payload.accessToken); const target = new URLSearchParams(window.location.search).get("return_to") || "/it-data-flow"; window.location.assign(target); } catch (cause) { setError(cause.message); } };
  return <section className="login-shell">
    <aside className="login-brand">
      <div className="login-lockup"><span className="login-mark" aria-hidden="true">M</span><span className="login-divider" />MIA'S CRUISES</div>
      <div className="login-copy"><p>CONNECTED OPERATIONS</p><h1>Every decision,<br />in view.</h1><span>One workspace for governed data intake, customer insight and business decisions.</span></div>
      <div className="login-pulse" aria-label="Current operational status"><div><span>System pulse</span><strong><i />Live</strong></div><p><i className="good" />Data pipeline <b>Ready</b></p><p><i className="good" />Decision workspace <b>Ready</b></p><p><i className="review" />Review queue <b>Monitored</b></p></div>
      <small className="login-footer">Mia's Cruises Customer Intelligence</small>
    </aside>
    <main className="login-panel"><form onSubmit={submit} className="login-form-wrap"><p className="login-eyebrow">SECURE WORKSPACE</p><h2>{mode === "register" ? "Create account" : "Sign in"}</h2><p className="login-intro">{mode === "register" ? "User ID: letters only, 3-32 characters. Password: exactly 6 digits." : "Use your workspace credentials to continue."}</p><label htmlFor="login-username">User ID</label><input id="login-username" value={username} onChange={(event) => setUsername(event.target.value.replace(/[^a-z]/gi, ""))} placeholder="Enter letters only" autoComplete="username" minLength={3} maxLength={32} required /><label htmlFor="login-password">Password</label><input id="login-password" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={password} onChange={(event) => setPassword(event.target.value.replace(/\D/g, ""))} placeholder="6 digits" autoComplete={mode === "register" ? "new-password" : "current-password"} required />{notice ? <p className="login-success" role="status">{notice}</p> : null}{error ? <p className="login-error" role="status">{error}</p> : null}<button className="login-submit" type="submit">{mode === "register" ? "Register" : "Sign in"} <span aria-hidden="true">→</span></button><button className="login-switch" type="button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); setNotice(""); }}>{mode === "register" ? "Already registered? Sign in" : "New user? Register"}</button></form></main>
  </section>;
}

export function App() {
  const isLoginPage = window.location.pathname === "/login";
  const pathname = useLocationState(React);
  const [routeFocus, setRouteFocus] = useRouteFocus();
  const [uploadSession, setUploadSession] = useState(() => loadUploadSession());
  const [accessToken] = useState(() => getAccessToken());
  const [datasetRuns, setDatasetRuns] = useState([]);
  const [activeDatasetRun, setActiveDatasetRun] = useState(() => new URLSearchParams(window.location.search).get("datasetRun") || "public");
  const activePath = normalizePath(pathname);
  const activeView = activeViewFromPath(activePath);
  const uploadedBatchId = uploadSession[activeView]?.batch?.id || null;
  const setUploadedBatch = (kind) => (batch) => setUploadSession((current) => {
    const next = { ...current, [kind]: batch || null };
    saveUploadSession(next);
    return next;
  });
  const RouteComponent = routeMap[activeView] || OverviewRoute;
  const routeLabel = getRouteLabel(activePath);
  const summary = getRouteAwareSummary(activePath);
  const exportText = useMemo(
    () =>
      buildPageBrief({
        pathname: activePath,
        routeFocus,
        title: routeLabel,
        summary
      }),
    [activePath, routeFocus, routeLabel, summary]
  );

  useEffect(() => {
    if (isLoginPage) return;
    if (requiresLogin(accessToken)) {
      window.location.replace(loginPageUrl());
    }
  }, [accessToken, isLoginPage]);

  if (isLoginPage) return <LoginPage />;

  useEffect(() => {
    if (window.location.pathname !== activePath) {
      window.history.replaceState({}, "", activePath);
    }
  }, [activePath]);

  useEffect(() => {
    getAccessToken();
  }, []);

  useEffect(() => { listDatasetRuns().then(setDatasetRuns).catch(() => setDatasetRuns([])); }, []);

  const selectDatasetRun = (value) => {
    setActiveDatasetRun(value);
    const url = new URL(window.location.href);
    if (value === "public") url.searchParams.delete("datasetRun"); else url.searchParams.set("datasetRun", value);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    window.dispatchEvent(new Event("dfds:navigate"));
  };

  useEffect(() => {
    const maskBrandText = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let node = walker.nextNode();

      while (node) {
        if (node.nodeValue.includes("DFDS")) nodes.push(node);
        node = walker.nextNode();
      }

      nodes.forEach((textNode) => {
        textNode.nodeValue = displayBrandText(textNode.nodeValue);
      });
    };

    maskBrandText();
    const observer = new MutationObserver(maskBrandText);
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    document.title = displayBrandText(document.title);

    return () => observer.disconnect();
  }, []);

  const handleExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
    } catch {
      window.prompt("Copy page brief", exportText);
    }
  };

  const showRouteFocus = isRouteAware(activePath);
  const showDatasetSelector = ["/overview", "/recommendations", "/customer-voice", "/app-reviews", "/passenger-profile", "/competitors"].includes(activePath);
  const schemaUnavailable = activeDatasetRun !== "public" && ["/customer-voice", "/app-reviews", "/passenger-profile", "/competitors"].includes(activePath);

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Product navigation">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 48 48" role="img" aria-label="Mia's Cruises logo">
            <rect width="48" height="48" rx="8" fill="#063556" />
            <path d="M13 28.5 24 13l11 15.5H13Z" fill="#fff" />
            <path d="M17 30.5c3.1 1.8 6.1 1.8 9.1 0 3.1-1.8 6.1-1.8 9.1 0" fill="none" stroke="#8ed6e8" strokeLinecap="round" strokeWidth="2.5" />
            <path d="M14 35c3.1 1.8 6.1 1.8 9.1 0 3.1-1.8 6.1-1.8 9.1 0" fill="none" stroke="#8ed6e8" strokeLinecap="round" strokeWidth="2.5" />
          </svg>
          <div>
            <p className="eyebrow">Voice of Customer</p>
            <h1>Mia's Cruises</h1>
          </div>
        </div>

        <nav className="nav">
          {navigationGroups.map((group) => (
            <details className="nav-group" key={group} open={routeConfig.some((item) => item.group === group && item.path === activePath)}>
              <summary className="nav-group-label">{group}</summary>
              {routeConfig.filter((item) => item.group === group).map((item) => (
                <a
                  key={item.path}
                  className={`nav-item${activePath === item.path ? " active" : ""}`}
                  href={item.path}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(item.path);
                  }}
                >
                  {item.label}
                </a>
              ))}
            </details>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-nav-button" type="button" onClick={() => { clearUploadSession(); window.location.assign(loginPageUrl()); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Company selected</p>
            <h2>Mia's Cruises</h2>
          </div>
          <div className="toolbar">
            {showRouteFocus ? (
              <div className="route-control">
                <label className="select-label" htmlFor="routeFilter">
                  Route focus
                </label>
                <select
                  id="routeFilter"
                  value={routeFocus}
                  onChange={(event) => setRouteFocus(event.target.value)}
                >
                  {routeFocusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <Badge tone="neutral">Global view</Badge>
            )}
            {showDatasetSelector ? <div className="route-control"><label className="select-label" htmlFor="datasetRun">Dataset</label><select id="datasetRun" value={activeDatasetRun} onChange={(event) => selectDatasetRun(event.target.value)}><option value="public">Public benchmark</option>{datasetRuns.map((item) => <option key={item.batchId} value={item.batchId}>{item.sourceType === "survey" ? "Survey" : "IT data"} · {item.version}</option>)}</select></div> : null}
            <button className="primary-button" type="button" onClick={handleExport}>
              Export page brief
            </button>
          </div>
        </header>

        {schemaUnavailable ? <section className="view active"><PageSummary title="This uploaded schema does not support this view" description="The selected dataset is available in Overview and Recommendations. This view needs source-specific dimensions that were not published with the current run." points={[]} /></section> : <RouteComponent
          data={data}
          routeFocus={routeFocus}
          setRouteFocus={setRouteFocus}
          pathname={activePath}
          onUploadedBatchChange={setUploadedBatch(activeView)}
          uploadSession={uploadSession}
          initialUploadedBatch={uploadSession[activeView] || null}
          activeDatasetRun={activeDatasetRun}
        />}
      </main>

      <ChatWidget pathname={activePath} routeFocus={routeFocus} uploadBatchId={uploadedBatchId} />
    </div>
  );
}

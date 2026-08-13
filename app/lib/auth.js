const workspaceSessions = {
  project_user: {
    token: "public-project-user",
    destination: "/it-data-flow"
  },
  administrator: {
    token: "public-administrator",
    destination: "/agent-control"
  }
};

export function loginPageUrl() {
  if (typeof window === "undefined") return "/login";
  const returnTo = `${window.location.pathname}${window.location.search}`;
  return `/login?return_to=${encodeURIComponent(returnTo)}`;
}

export function requiresLogin(accessToken) {
  return !String(accessToken || "").trim();
}

export function resolveWorkspaceDestination(accountRole, workspaceRole, returnTo = "") {
  if (workspaceRole === "administrator") {
    if (accountRole !== "administrator") {
      throw new Error("Administrator access is required");
    }
    return "/agent-control";
  }

  return "/it-data-flow";
}

export function startWorkspaceSession(role, storage = window.localStorage) {
  const session = workspaceSessions[role];
  if (!session) throw new Error("Unknown workspace role");

  storage.setItem("dfds-access-token", session.token);
  storage.setItem("dfds-account-role", role);
  storage.setItem("dfds-workspace-role", role);
  return session.destination;
}

export function getWorkspaceRole() {
  return window.localStorage.getItem("dfds-workspace-role") || "project_user";
}

export function clearAuthentication() {
  window.localStorage.removeItem("dfds-access-token");
  window.localStorage.removeItem("dfds-workspace-role");
  window.localStorage.removeItem("dfds-account-role");
}

export function getAccessToken() {
  const params = new URLSearchParams(window.location.search);
  const tokenFromLogin = params.get("access_token");
  if (tokenFromLogin) {
    window.localStorage.setItem("dfds-access-token", tokenFromLogin);
    params.delete("access_token");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }
  return window.localStorage.getItem("dfds-access-token") || "";
}

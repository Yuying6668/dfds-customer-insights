export function loginPageUrl() {
  if (typeof window === "undefined") return "/login";
  const returnTo = `${window.location.pathname}${window.location.search}`;
  return `/login?return_to=${encodeURIComponent(returnTo)}`;
}

export function requiresLogin(accessToken) {
  return !String(accessToken || "").trim();
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

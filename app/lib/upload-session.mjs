const STORAGE_KEY = "dfds-upload-session";

export function loadUploadSession() {
  try { return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}

export function saveUploadSession(value) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function clearUploadSession() {
  window.sessionStorage.removeItem(STORAGE_KEY);
}

import { getAccessToken } from "../../lib/auth.js";

function authorizationHeaders() {
  return { Authorization: `Bearer ${getAccessToken()}` };
}

export function uploadBatch(files, { signal, onProgress, sourceType } = {}) {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  onProgress?.(5);

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const query = sourceType ? `?source_type=${encodeURIComponent(sourceType)}` : "";
    request.open("POST", `/api/upload-batches${query}`);
    request.setRequestHeader("Authorization", authorizationHeaders().Authorization);
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(85, Math.max(5, Math.round((event.loaded / event.total) * 85))));
    };
    request.upload.onloadend = () => onProgress?.(90);
    request.onload = () => {
      const payload = request.response || {};
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(payload.error || "Upload could not be completed"));
        return;
      }
      onProgress?.(100);
      resolve(payload);
    };
    request.onerror = () => reject(new Error("Upload could not be completed"));
    request.onabort = () => reject(new DOMException("Upload was cancelled", "AbortError"));
    if (signal) signal.addEventListener("abort", () => request.abort(), { once: true });
    request.send(formData);
  });
}

export async function reviewUploadedBatch(batchId) {
  const response = await fetch(`/api/upload-batches/${encodeURIComponent(batchId)}/ai-review`, { method: "POST", headers: authorizationHeaders() });
  const payload = await response.json();
  if (!response.ok) {
    if (response.status === 404) throw new Error("The business summary is temporarily unavailable. Please try again shortly.");
    throw new Error(payload.error || "AI review could not be completed");
  }
  return payload;
}

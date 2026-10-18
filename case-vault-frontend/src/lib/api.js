const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "case_vault_access_token";

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function errorMessage(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg || "Invalid field").join("; ");
  return "The request could not be completed.";
}

export async function api(path, { body, headers, ...options } = {}) {
  const token = getToken();
  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) requestHeaders["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: requestHeaders,
      body: body instanceof FormData ? body : body == null ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the Case Vault API. Check that the backend is running.", 0);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event("case-vault-session-expired"));
    }
    throw new ApiError(errorMessage(data.detail), response.status);
  }
  if (response.status === 204) return null;
  if (response.headers.get("content-type")?.includes("application/json")) return response.json();
  return response.blob();
}

export async function streamAudit(onEntries, signal, onPresence) {
  const token = getToken();
  const response = await fetch(`${API_BASE}/audit/stream?limit=500`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event("case-vault-session-expired"));
    }
    throw new ApiError(errorMessage(data.detail), response.status);
  }
  if (!response.body) throw new ApiError("Live activity is unavailable in this browser.", 0);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replaceAll("\r\n", "\n");
      let end = buffer.indexOf("\n\n");
      while (end !== -1) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const lines = event.split("\n");
        const eventType = lines.find((line) => line.startsWith("event: "))?.slice(7);
        if (eventType === "ledger" || eventType === "presence") {
          const data = lines.filter((line) => line.startsWith("data: "))
            .map((line) => line.slice(6)).join("\n");
          if (eventType === "ledger") onEntries(JSON.parse(data));
          else onPresence?.(JSON.parse(data));
        }
        end = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function philippineDate(value) {
  if (!value) return "—";
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  return new Date(normalized).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }) + " PHT";
}

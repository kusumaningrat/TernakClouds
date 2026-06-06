import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from "./auth";
import type { TokenResponse } from "./types";

// In development the Vite proxy forwards /api → http://localhost:8080 (no CORS needed).
// In production set VITE_API_URL to the absolute backend origin (e.g. https://api.example.com).
const BASE_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function attemptRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: TokenResponse };
    storeTokens(json.data.access_token, json.data.refresh_token);
    return json.data.access_token;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  authenticated = true,
  isRetry = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };

  if (authenticated) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  // Token expired — try one rotation
  if (res.status === 401 && authenticated && !isRetry) {
    const newToken = await attemptRefresh();
    if (newToken) return request<T>(path, init, authenticated, true);
    clearTokens();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "Session expired. Please sign in again.");
  }

  if (!res.ok) {
    let message = "Request failed";
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      /* ignore parse error */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;

  // Backend wraps responses as { data: T } (RespondOK) or { message: string } (RespondMessage)
  const json = (await res.json()) as Record<string, unknown>;
  return ("data" in json ? json.data : json) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),

  post: <T>(path: string, body: unknown, authenticated = true) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, authenticated),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};

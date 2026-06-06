import type { JWTClaims } from "./types";

const ACCESS_KEY = "Clouds_access_token";
const REFRESH_KEY = "Clouds_refresh_token";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function storeTokens(accessToken: string, refreshToken: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function clearTokens(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function parseJWT(token: string): JWTClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → base64
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(padded)) as JWTClaims;
  } catch {
    return null;
  }
}

export function getAuthUser(): JWTClaims | null {
  const token = getAccessToken();
  if (!token) return null;
  const claims = parseJWT(token);
  if (!claims) return null;
  // Check expiry (exp is Unix seconds)
  if (Date.now() / 1000 > claims.exp) return null;
  return claims;
}

export function isAuthenticated(): boolean {
  return getAuthUser() !== null;
}

/** Seconds remaining before the access token expires. Returns 0 if expired/absent. */
export function tokenTTLSeconds(): number {
  const claims = getAuthUser();
  if (!claims) return 0;
  return Math.max(0, Math.floor(claims.exp - Date.now() / 1000));
}

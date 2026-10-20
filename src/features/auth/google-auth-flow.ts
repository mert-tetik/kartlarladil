export const GOOGLE_AUTH_PENDING_STORAGE_KEY = "foxiesdeck:google-auth-pending";
export const GOOGLE_AUTH_PENDING_EVENT = "foxiesdeck:google-auth-pending-changed";

export const GOOGLE_AUTH_PENDING_TIMEOUT_MS = 30_000;

export function markGoogleAuthPending() {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(GOOGLE_AUTH_PENDING_STORAGE_KEY, String(Date.now()));
  window.dispatchEvent(new Event(GOOGLE_AUTH_PENDING_EVENT));
}

export function clearGoogleAuthPending() {
  if (typeof window === "undefined") return;

  if (window.sessionStorage.getItem(GOOGLE_AUTH_PENDING_STORAGE_KEY) === null) return;

  window.sessionStorage.removeItem(GOOGLE_AUTH_PENDING_STORAGE_KEY);
  window.dispatchEvent(new Event(GOOGLE_AUTH_PENDING_EVENT));
}

export function getGoogleAuthPendingStartedAt() {
  if (typeof window === "undefined") return null;

  const rawValue = window.sessionStorage.getItem(GOOGLE_AUTH_PENDING_STORAGE_KEY);
  if (rawValue === null) return null;

  const startedAt = rawValue ? Number(rawValue) : NaN;

  if (!Number.isFinite(startedAt)) {
    clearGoogleAuthPending();
    return null;
  }

  if (Date.now() - startedAt > GOOGLE_AUTH_PENDING_TIMEOUT_MS) {
    clearGoogleAuthPending();
    return null;
  }

  return startedAt;
}

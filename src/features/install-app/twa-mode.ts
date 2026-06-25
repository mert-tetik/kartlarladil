const TWA_REFERRER_PREFIX = "android-app://com.foxiesdeck";
const TWA_MODE_KEY = "foxiesdeck:twa-mode";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readTwaFlagFromSession(): boolean | null {
  if (!isBrowser()) return null;
  const value = window.sessionStorage.getItem(TWA_MODE_KEY);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function detectTwaFromEnvironment(): boolean {
  if (!isBrowser()) return false;

  const referrer = document.referrer || "";
  const isFromAndroidApp = referrer.startsWith(TWA_REFERRER_PREFIX);

  const params = new URLSearchParams(window.location.search);
  const hasApkOverride = params.has("apk") || params.has("twa");

  return isFromAndroidApp || hasApkOverride;
}

let storeValue = false;
let storeInitialized = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

/**
 * Subscribe to TWA mode changes. Used by `useTwaMode`.
 */
export function subscribeTwaMode(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Snapshot of the current TWA mode. Used by `useTwaMode`.
 */
export function getTwaModeSnapshot(): boolean {
  return storeValue;
}

/**
 * Initialize the TWA mode store. Should be called once after the client
 * hydrates. It detects the TWA environment and notifies subscribers.
 */
export function initTwaModeStore(): void {
  if (storeInitialized || !isBrowser()) return;
  storeInitialized = true;

  const detected = detectTwaFromEnvironment();
  if (detected !== storeValue) {
    storeValue = detected;
    window.sessionStorage.setItem(TWA_MODE_KEY, String(detected));
    notifyListeners();
  }
}

/**
 * Returns true if the page is running inside the FoxiesDeck TWA/APK.
 *
 * Detection is based on the Android app referrer (`android-app://com.foxiesdeck`)
 * on first navigation. The result is cached in sessionStorage so it survives
 * same-origin page transitions.
 *
 * Note: this is client-side only; server-side renders always return false.
 */
export function getTwaMode(): boolean {
  if (!isBrowser()) return false;

  const cached = readTwaFlagFromSession();
  if (cached !== null) return cached;

  const detected = detectTwaFromEnvironment();
  window.sessionStorage.setItem(TWA_MODE_KEY, String(detected));
  return detected;
}

/**
 * Explicitly override the TWA flag for the current session.
 * Useful for testing or for forcing a specific UI branch.
 */
export function setTwaMode(value: boolean): void {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(TWA_MODE_KEY, String(value));
}

/**
 * Returns true if the page is running as a standalone PWA (installed from
 * browser). This is separate from the TWA/APK detection.
 */
export function isPwaStandalone(): boolean {
  if (!isBrowser()) return false;

  const displayMode = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  return displayMode || iosStandalone;
}

/**
 * Returns true if the page is running inside any installed app surface:
 * either the TWA/APK or a browser-installed PWA.
 */
export function isInstalledApp(): boolean {
  return getTwaMode() || isPwaStandalone();
}

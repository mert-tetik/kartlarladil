const DEFAULT_TWA_PACKAGE_NAME = "com.LigidTools.Glidecore";
export const TWA_PACKAGE_NAME =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_TWA_PACKAGE_NAME) ||
  DEFAULT_TWA_PACKAGE_NAME;

// Keep the old package prefix so existing installs keep working after the
// package rename. New installs use the configured/current package name.
const TWA_REFERRER_PREFIXES = [
  `android-app://${TWA_PACKAGE_NAME}`,
  "android-app://com.foxiesdeck",
];

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
  const isFromAndroidApp = TWA_REFERRER_PREFIXES.some((prefix) =>
    referrer.startsWith(prefix)
  );

  const params = new URLSearchParams(window.location.search);
  const hasApkOverride = params.has("apk") || params.has("twa");

  // Play Store TWA exposes the Digital Goods API even when the address bar is
  // still visible because of a temporary assetlinks failure. Use it as an extra
  // signal so the Google Play Billing UI is shown in the right context.
  const hasDigitalGoodsApi =
    typeof window !== "undefined" &&
    "getDigitalGoodsService" in window &&
    typeof (window as Window & { getDigitalGoodsService?: unknown })
      .getDigitalGoodsService === "function";

  return isFromAndroidApp || hasApkOverride || hasDigitalGoodsApi;
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
 * Detection is based on the Android app referrer (`android-app://<package>`),
 * manual URL overrides (`?twa` / `?apk`), or the presence of the Digital Goods
 * API. The result is cached in sessionStorage so it survives
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

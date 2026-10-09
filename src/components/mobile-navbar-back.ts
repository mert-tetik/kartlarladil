const MOBILE_NAVBAR_BACK_OVERRIDE_EVENT = "foxiesdeck:mobile-navbar-back-override";
const MOBILE_NAVBAR_BACK_REQUEST_EVENT = "foxiesdeck:mobile-navbar-back-request";

let mobileNavbarBackOverrideActive = false;
const mobileNavbarBackOverrideListeners = new Set<() => void>();

export function setMobileNavbarBackOverride(active: boolean) {
  mobileNavbarBackOverrideActive = active;

  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<boolean>(MOBILE_NAVBAR_BACK_OVERRIDE_EVENT, { detail: active }));
  mobileNavbarBackOverrideListeners.forEach((listener) => listener());
}

export function getMobileNavbarBackOverride() {
  return mobileNavbarBackOverrideActive;
}

export function subscribeMobileNavbarBackOverride(onChange: () => void) {
  mobileNavbarBackOverrideListeners.add(onChange);
  return () => mobileNavbarBackOverrideListeners.delete(onChange);
}

export function requestMobileNavbarBack() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MOBILE_NAVBAR_BACK_REQUEST_EVENT));
}

export function subscribeMobileNavbarBackRequest(onRequest: () => void) {
  window.addEventListener(MOBILE_NAVBAR_BACK_REQUEST_EVENT, onRequest);
  return () => window.removeEventListener(MOBILE_NAVBAR_BACK_REQUEST_EVENT, onRequest);
}

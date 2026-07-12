const MOBILE_NAVBAR_BACK_OVERRIDE_EVENT = "foxiesdeck:mobile-navbar-back-override";
const MOBILE_NAVBAR_BACK_REQUEST_EVENT = "foxiesdeck:mobile-navbar-back-request";

export function setMobileNavbarBackOverride(active: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<boolean>(MOBILE_NAVBAR_BACK_OVERRIDE_EVENT, { detail: active }));
}

export function subscribeMobileNavbarBackOverride(onChange: (active: boolean) => void) {
  function handleOverride(event: Event) {
    onChange((event as CustomEvent<boolean>).detail);
  }

  window.addEventListener(MOBILE_NAVBAR_BACK_OVERRIDE_EVENT, handleOverride);
  return () => window.removeEventListener(MOBILE_NAVBAR_BACK_OVERRIDE_EVENT, handleOverride);
}

export function requestMobileNavbarBack() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MOBILE_NAVBAR_BACK_REQUEST_EVENT));
}

export function subscribeMobileNavbarBackRequest(onRequest: () => void) {
  window.addEventListener(MOBILE_NAVBAR_BACK_REQUEST_EVENT, onRequest);
  return () => window.removeEventListener(MOBILE_NAVBAR_BACK_REQUEST_EVENT, onRequest);
}

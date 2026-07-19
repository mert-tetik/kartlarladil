const ROUTE_TRANSITION_EVENT = "foxiesdeck:route-transition";

export const ROUTE_TRANSITION_COVER_DURATION_MS = 260;
const ROUTE_NAVIGATION_DELAY_MS = ROUTE_TRANSITION_COVER_DURATION_MS + 30;

let pendingNavigationTimer: number | null = null;

export function requestRouteTransition() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ROUTE_TRANSITION_EVENT));
}

export function navigateWithRouteTransition(navigate: () => void) {
  if (typeof window === "undefined") {
    navigate();
    return;
  }

  if (pendingNavigationTimer !== null) {
    window.clearTimeout(pendingNavigationTimer);
  }

  requestRouteTransition();
  pendingNavigationTimer = window.setTimeout(() => {
    pendingNavigationTimer = null;
    navigate();
  }, ROUTE_NAVIGATION_DELAY_MS);
}

export function subscribeRouteTransition(onStart: () => void) {
  window.addEventListener(ROUTE_TRANSITION_EVENT, onStart);
  return () => window.removeEventListener(ROUTE_TRANSITION_EVENT, onStart);
}

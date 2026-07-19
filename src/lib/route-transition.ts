const ROUTE_TRANSITION_EVENT = "foxiesdeck:route-transition";

export function requestRouteTransition() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ROUTE_TRANSITION_EVENT));
}

export function subscribeRouteTransition(onStart: () => void) {
  window.addEventListener(ROUTE_TRANSITION_EVENT, onStart);
  return () => window.removeEventListener(ROUTE_TRANSITION_EVENT, onStart);
}

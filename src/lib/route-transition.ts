const ROUTE_TRANSITION_EVENT = "foxiesdeck:route-transition";
const ROUTE_TRANSITION_CANCEL_EVENT = "foxiesdeck:route-transition-cancel";

export const ROUTE_TRANSITION_COVER_DURATION_MS = 260;

export function shouldAnimateRouteTransition(previousPathname: string, nextPathname: string) {
  // Query-only state changes on the landing page (auth/tutorial/offer flags)
  // should not replay the whole landing entrance animation.
  return previousPathname !== nextPathname || nextPathname !== "/";
}

let pendingNavigationTimer: number | null = null;
let pendingNavigationCleanup: (() => void) | null = null;

export function requestRouteTransition() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ROUTE_TRANSITION_EVENT));
}

export function cancelRouteTransition() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ROUTE_TRANSITION_CANCEL_EVENT));
}

export function cancelPendingNavigationTransition() {
  if (typeof window === "undefined" || pendingNavigationTimer === null) return;

  window.clearTimeout(pendingNavigationTimer);
  pendingNavigationTimer = null;
  pendingNavigationCleanup?.();
  pendingNavigationCleanup = null;
  cancelRouteTransition();
}

export function navigateWithRouteTransition(navigate: () => void) {
  if (typeof window === "undefined") {
    navigate();
    return;
  }

  cancelPendingNavigationTransition();

  requestRouteTransition();
  pendingNavigationTimer = window.setTimeout(() => {
    pendingNavigationTimer = null;
    pendingNavigationCleanup?.();
    pendingNavigationCleanup = null;
    navigate();
  }, ROUTE_TRANSITION_COVER_DURATION_MS + 30);

  const cancelForPageHide = () => cancelPendingNavigationTransition();
  const cancelWhenHidden = () => {
    if (document.visibilityState === "hidden") cancelPendingNavigationTransition();
  };
  window.addEventListener("pagehide", cancelForPageHide);
  window.addEventListener("popstate", cancelForPageHide);
  document.addEventListener("visibilitychange", cancelWhenHidden);
  pendingNavigationCleanup = () => {
    window.removeEventListener("pagehide", cancelForPageHide);
    window.removeEventListener("popstate", cancelForPageHide);
    document.removeEventListener("visibilitychange", cancelWhenHidden);
  };
}

export function subscribeRouteTransition(onStart: () => void, onCancel?: () => void) {
  window.addEventListener(ROUTE_TRANSITION_EVENT, onStart);
  if (onCancel) window.addEventListener(ROUTE_TRANSITION_CANCEL_EVENT, onCancel);
  return () => {
    window.removeEventListener(ROUTE_TRANSITION_EVENT, onStart);
    if (onCancel) window.removeEventListener(ROUTE_TRANSITION_CANCEL_EVENT, onCancel);
  };
}

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ROUTE_TRANSITION_COVER_DURATION_MS,
  cancelPendingNavigationTransition,
  consumeSkippedRouteTransition,
  navigateWithRouteTransition,
  requestRouteTransition,
  skipNextRouteTransitionTo,
  shouldAnimateRouteTransition,
  subscribeRouteTransition,
} from "@/lib/route-transition";

afterEach(() => {
  cancelPendingNavigationTransition();
  vi.useRealTimers();
});

describe("route transition events", () => {
  it("does not replay the landing entrance for query-only landing state changes", () => {
    expect(shouldAnimateRouteTransition("/", "/")).toBe(false);
    expect(shouldAnimateRouteTransition("/learn", "/learn")).toBe(true);
    expect(shouldAnimateRouteTransition("/learn", "/")).toBe(true);
  });

  it("does not animate an auth handoff into the landing route", () => {
    expect(shouldAnimateRouteTransition("/login", "/", { authGatewayVisible: true })).toBe(false);
    expect(shouldAnimateRouteTransition("/login", "/", { skipTransition: true })).toBe(false);
    expect(shouldAnimateRouteTransition("/login", "/")).toBe(true);
  });

  it("consumes a route-entry skip once and only for its intended destination", () => {
    skipNextRouteTransitionTo("/");
    expect(consumeSkippedRouteTransition("/login")).toBe(false);
    expect(consumeSkippedRouteTransition("/")).toBe(false);

    skipNextRouteTransitionTo("/");
    expect(consumeSkippedRouteTransition("/")).toBe(true);
    expect(consumeSkippedRouteTransition("/")).toBe(false);
  });

  it("notifies subscribers when a transition is requested", () => {
    const onStart = vi.fn();
    const unsubscribe = subscribeRouteTransition(onStart);

    requestRouteTransition();

    expect(onStart).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("stops notifying an unsubscribed listener", () => {
    const onStart = vi.fn();
    const unsubscribe = subscribeRouteTransition(onStart);

    unsubscribe();
    requestRouteTransition();

    expect(onStart).not.toHaveBeenCalled();
  });

  it("waits for the cover animation before navigating", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();

    navigateWithRouteTransition(navigate);

    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ROUTE_TRANSITION_COVER_DURATION_MS);
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending navigation if the page is hidden or the user goes back", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();

    navigateWithRouteTransition(navigate);
    window.dispatchEvent(new Event("pagehide"));
    vi.advanceTimersByTime(ROUTE_TRANSITION_COVER_DURATION_MS + 100);

    expect(navigate).not.toHaveBeenCalled();
  });
});

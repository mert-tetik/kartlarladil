import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ROUTE_TRANSITION_COVER_DURATION_MS,
  navigateWithRouteTransition,
  requestRouteTransition,
  subscribeRouteTransition,
} from "@/lib/route-transition";

afterEach(() => {
  vi.useRealTimers();
});

describe("route transition events", () => {
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
});

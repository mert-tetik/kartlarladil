import { describe, expect, it, vi } from "vitest";
import { requestRouteTransition, subscribeRouteTransition } from "@/lib/route-transition";

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
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingWebSubscriptionCheckout,
  hasPendingWebSubscriptionCheckout,
  markPendingWebSubscriptionCheckout,
} from "@/features/subscriptions/subscription-purchase-success";

describe("subscription purchase success marker", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("only keeps a fresh checkout intent", () => {
    expect(hasPendingWebSubscriptionCheckout()).toBe(false);

    markPendingWebSubscriptionCheckout();
    expect(hasPendingWebSubscriptionCheckout()).toBe(true);

    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(hasPendingWebSubscriptionCheckout()).toBe(false);
  });

  it("clears the intent once the checkout result has been consumed", () => {
    markPendingWebSubscriptionCheckout();
    clearPendingWebSubscriptionCheckout();

    expect(hasPendingWebSubscriptionCheckout()).toBe(false);
  });
});

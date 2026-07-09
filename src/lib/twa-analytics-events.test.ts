import { beforeEach, describe, expect, it, vi } from "vitest";
import { isFirstLearnedTransition, trackPointMilestones } from "@/lib/twa-analytics-events";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";

vi.mock("@/lib/twa-analytics", () => ({
  sendTwaAnalyticsEvent: vi.fn(),
}));

describe("twa analytics event helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks every crossed points milestone", () => {
    trackPointMilestones(90, 520);

    expect(sendTwaAnalyticsEvent).toHaveBeenCalledTimes(3);
    expect(sendTwaAnalyticsEvent).toHaveBeenNthCalledWith(1, "fd_points_100_reached", {
      params: { points: 100, total_points: 520 },
    });
    expect(sendTwaAnalyticsEvent).toHaveBeenNthCalledWith(2, "fd_points_200_reached", {
      params: { points: 200, total_points: 520 },
    });
    expect(sendTwaAnalyticsEvent).toHaveBeenNthCalledWith(3, "fd_points_500_reached", {
      params: { points: 500, total_points: 520 },
    });
  });

  it("does not track milestones when points do not increase", () => {
    trackPointMilestones(500, 500);
    trackPointMilestones(500, 400);

    expect(sendTwaAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("detects the first learned transition only once", () => {
    expect(isFirstLearnedTransition("active", "learned")).toBe(true);
    expect(isFirstLearnedTransition("learned", "learned")).toBe(false);
    expect(isFirstLearnedTransition("active", "active")).toBe(false);
  });
});

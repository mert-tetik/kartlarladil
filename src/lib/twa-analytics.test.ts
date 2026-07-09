import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTwaMode } from "@/features/install-app/twa-mode";
import { isTwaMode, sendTwaAnalyticsEvent, setTwaAnalyticsUserId } from "@/lib/twa-analytics";

vi.mock("@/features/install-app/twa-mode", () => ({
  getTwaMode: vi.fn(),
}));

describe("twa analytics bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("reads TWA mode from the shared detector", () => {
    vi.mocked(getTwaMode).mockReturnValue(true);
    expect(isTwaMode()).toBe(true);

    vi.mocked(getTwaMode).mockReturnValue(false);
    expect(isTwaMode()).toBe(false);
  });

  it("sends analytics events through the TWA bridge when TWA mode is active", () => {
    vi.mocked(getTwaMode).mockReturnValue(true);

    sendTwaAnalyticsEvent("fd_screen_view", {
      params: { screen_name: "/learn" },
    });

    const iframe = document.body.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toBe("foxiesdeck://event?type=fd_screen_view&screen_name=%2Flearn");
  });

  it("does not send analytics events outside TWA mode", () => {
    vi.mocked(getTwaMode).mockReturnValue(false);

    sendTwaAnalyticsEvent("fd_screen_view");

    expect(document.body.querySelector("iframe")).toBeNull();
  });

  it("deduplicates one-time events", () => {
    vi.mocked(getTwaMode).mockReturnValue(true);

    sendTwaAnalyticsEvent("fd_first_card_added", { once: true });
    sendTwaAnalyticsEvent("fd_first_card_added", { once: true });

    expect(document.body.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("sends the TWA user id through the bridge", () => {
    vi.mocked(getTwaMode).mockReturnValue(true);

    setTwaAnalyticsUserId("user-123");

    const iframe = document.body.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toBe("foxiesdeck://event?type=set_user_id&user_id=user-123");
  });

  it("removes the bridge iframe after dispatching", () => {
    vi.useFakeTimers();
    vi.mocked(getTwaMode).mockReturnValue(true);

    sendTwaAnalyticsEvent("fd_screen_view");
    expect(document.body.querySelector("iframe")).not.toBeNull();

    vi.advanceTimersByTime(1000);

    expect(document.body.querySelector("iframe")).toBeNull();
  });
});

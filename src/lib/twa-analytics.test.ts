import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTwaMode } from "@/features/install-app/twa-mode";
import { isTwaMode, sendTwaAnalyticsEvent, setTwaAnalyticsUserId } from "@/lib/twa-analytics";

vi.mock("@/features/install-app/twa-mode", () => ({
  getTwaMode: vi.fn(),
}));

describe("twa analytics bridge", () => {
  const originalLocation = window.location;
  let replaceMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    replaceMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        replace: replaceMock,
      },
    });
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

    expect(replaceMock).toHaveBeenCalledWith("foxiesdeck://event?type=fd_screen_view&screen_name=%2Flearn");
  });

  it("does not send analytics events outside TWA mode", () => {
    vi.mocked(getTwaMode).mockReturnValue(false);

    sendTwaAnalyticsEvent("fd_screen_view");

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("deduplicates one-time events", () => {
    vi.mocked(getTwaMode).mockReturnValue(true);

    sendTwaAnalyticsEvent("fd_first_card_added", { once: true });
    sendTwaAnalyticsEvent("fd_first_card_added", { once: true });

    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  it("sends the TWA user id through the bridge", () => {
    vi.mocked(getTwaMode).mockReturnValue(true);

    setTwaAnalyticsUserId("user-123");

    expect(replaceMock).toHaveBeenCalledWith("foxiesdeck://event?type=set_user_id&user_id=user-123");
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PostPracticeLeaderboardConsentGate } from "@/features/leaderboard/components/post-practice-leaderboard-consent-gate";
import {
  POST_PRACTICE_NOTIFICATION_PROMPT_EVENT,
  POST_PRACTICE_TUTORIAL_COMPLETED_EVENT,
} from "@/features/push/push-client";

const mockUseAuthSession = vi.fn();

vi.mock("@/features/auth/auth-client", () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

vi.mock("@/i18n/locale-provider", () => ({
  useT: () => (key: string) =>
    ({
      "leaderboard.allowTitle": "Join the leaderboard?",
      "leaderboard.allowDescription": "Description",
      "leaderboard.allowCancel": "Not now",
      "leaderboard.allowConfirm": "Join leaderboard",
      "leaderboard.loadFailed": "Load failed",
      "common.loading": "Loading",
    })[key] ?? key,
}));

describe("PostPracticeLeaderboardConsentGate", () => {
  beforeEach(() => {
    mockUseAuthSession.mockReturnValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        profile: {
          leaderboardVisible: false,
        },
      },
      updateProfileField: vi.fn(),
    });
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("opens the leaderboard consent dialog before dispatching the notification prompt", async () => {
    const notificationListener = vi.fn();
    window.addEventListener(POST_PRACTICE_NOTIFICATION_PROMPT_EVENT, notificationListener);

    render(<PostPracticeLeaderboardConsentGate />);

    window.dispatchEvent(new CustomEvent(POST_PRACTICE_TUTORIAL_COMPLETED_EVENT));

    expect(await screen.findByRole("dialog", { name: "Join the leaderboard?" })).toBeVisible();
    expect(notificationListener).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    await waitFor(() => {
      expect(notificationListener).toHaveBeenCalledTimes(1);
    });

    window.removeEventListener(POST_PRACTICE_NOTIFICATION_PROMPT_EVENT, notificationListener);
  });

  it("skips the dialog after the one-time auto prompt has already been shown", async () => {
    window.localStorage.setItem("foxiesdeck:leaderboard:auto-consent-prompted:user-1", "1");
    const notificationListener = vi.fn();
    window.addEventListener(POST_PRACTICE_NOTIFICATION_PROMPT_EVENT, notificationListener);

    render(<PostPracticeLeaderboardConsentGate />);

    window.dispatchEvent(new CustomEvent(POST_PRACTICE_TUTORIAL_COMPLETED_EVENT));

    await waitFor(() => {
      expect(notificationListener).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByRole("dialog", { name: "Join the leaderboard?" })).not.toBeInTheDocument();

    window.removeEventListener(POST_PRACTICE_NOTIFICATION_PROMPT_EVENT, notificationListener);
  });
});

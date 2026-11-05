import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionProvider, useAuthSession } from "@/features/auth/auth-client";
import type { AuthShellUser } from "@/features/auth/auth-types";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: () => true,
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    from: mocks.from,
  }),
}));

vi.mock("@/lib/twa-analytics", () => ({
  setTwaAnalyticsUserId: vi.fn(),
}));

const initialUser: AuthShellUser = {
  id: "user-1",
  email: "test@example.com",
  profile: {
    displayName: "Test User",
    preferredLanguageCode: "en",
    preferredUiLocale: "en",
    preferredTier: "A1",
    onboardingCompleted: true,
    aiPracticePoints: 0,
    chestPoints: 0,
    streakPoints: 0,
    missionPoints: 0,
    quizResultPoints: 0,
    quizResultMedals: 0,
    gamePoints: 0,
    gemPoints: 0,
    blueGems: 0,
    greenGems: 0,
    purpleGems: 0,
    pushMarketingEnabled: false,
    leaderboardVisible: false,
    profilePictureIndex: null,
  },
};

const syncedProfile = {
  display_name: "Test User",
  preferred_language_code: "en",
  preferred_ui_locale: "en",
  preferred_tier: "A1",
  onboarding_completed: true,
  ai_practice_points: 0,
  chest_points: 0,
  streak_points: 0,
  mission_points: 0,
  quiz_result_points: 0,
  quiz_result_medals: 0,
  game_points: 0,
  gem_points: 0,
  blue_gems: 0,
  green_gems: 0,
  purple_gems: 0,
  push_marketing_enabled: false,
  leaderboard_visible: false,
  profile_picture_index: null,
};

let resolveInitialSession!: (result: {
  data: { session: { user: { id: string; email: string } } | null };
}) => void;

function SessionStateProbe() {
  const { user, clearUser, isSessionReady } = useAuthSession();

  return (
    <>
      <output data-testid="session-state">{user?.email ?? "signed-out"}</output>
      <output data-testid="session-ready">{String(isSessionReady)}</output>
      <button type="button" onClick={clearUser}>Sign out locally</button>
    </>
  );
}

describe("AuthSessionProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mocks.getSession.mockReturnValue(new Promise((resolve) => {
      resolveInitialSession = resolve;
    }));
    mocks.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: syncedProfile, error: null }),
    }));
  });

  it("does not restore a stale initial session after logout was requested", async () => {
    const user = userEvent.setup();

    render(
      <AuthSessionProvider user={initialUser}>
        <SessionStateProbe />
      </AuthSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Sign out locally" }));
    expect(screen.getByTestId("session-state")).toHaveTextContent("signed-out");

    await act(async () => {
      resolveInitialSession({
        data: { session: { user: { id: initialUser.id, email: initialUser.email } } },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(screen.getByTestId("session-state")).toHaveTextContent("signed-out");
  });

  it("keeps the browser session when a stale server refresh temporarily reports no user", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: initialUser.id, email: initialUser.email } } },
      error: null,
    });

    const { rerender } = render(
      <AuthSessionProvider user={initialUser}>
        <SessionStateProbe />
      </AuthSessionProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    rerender(
      <AuthSessionProvider user={null}>
        <SessionStateProbe />
      </AuthSessionProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("session-state")).toHaveTextContent(initialUser.email);
  });

  it("does not mark a signed-out server snapshot ready until the browser session is restored", async () => {
    render(
      <AuthSessionProvider user={null}>
        <SessionStateProbe />
      </AuthSessionProvider>,
    );

    expect(screen.getByTestId("session-ready")).toHaveTextContent("false");

    await act(async () => {
      resolveInitialSession({
        data: { session: { user: { id: initialUser.id, email: initialUser.email } } },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("session-state")).toHaveTextContent(initialUser.email);
    expect(screen.getByTestId("session-ready")).toHaveTextContent("true");
  });

  it("unblocks the auth flow when browser session initialization never resolves", async () => {
    vi.useFakeTimers();

    try {
      render(
        <AuthSessionProvider user={null}>
          <SessionStateProbe />
        </AuthSessionProvider>,
      );

      expect(screen.getByTestId("session-ready")).toHaveTextContent("false");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(screen.getByTestId("session-ready")).toHaveTextContent("true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a valid browser session signed in while its profile query is pending", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: initialUser.id, email: initialUser.email } } },
      error: null,
    });
    mocks.from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => new Promise(() => undefined)),
    }));

    render(
      <AuthSessionProvider user={null}>
        <SessionStateProbe />
      </AuthSessionProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("session-state")).toHaveTextContent(initialUser.email);
    expect(screen.getByTestId("session-ready")).toHaveTextContent("true");
  });
});

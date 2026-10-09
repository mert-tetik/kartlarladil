import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/i18n/locale-provider";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { MobileDayStreakOverlayProvider } from "@/app/components/mobile-day-streak-overlay-provider";
import { markQuizReturnToLanding } from "@/features/daily-streak/daily-streak-landing-return";

vi.mock("@/features/leaderboard/use-leaderboard", () => ({
  useLeaderboardData: () => ({ data: null }),
}));

const user = { id: "user-for-streak-reminder-test" } as AuthShellUser;

describe("MobileDayStreakOverlayProvider landing reminder", () => {
  it("opens once after a quiz returns to landing and does not reopen on the same day", () => {
    vi.useFakeTimers();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query === "(max-width: 1023px)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    markQuizReturnToLanding();

    render(
      <LocaleProvider initialLocale="tr">
        <AuthSessionProvider user={user}>
          <ThemeProvider initialTheme="default-dark">
            <MobileDayStreakOverlayProvider>
              <div>Landing page</div>
            </MobileDayStreakOverlayProvider>
          </ThemeProvider>
        </AuthSessionProvider>
      </LocaleProvider>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kapat" }));
    act(() => {
      vi.advanceTimersByTime(360);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    markQuizReturnToLanding();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });
});

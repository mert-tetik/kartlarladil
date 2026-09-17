import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/i18n/locale-provider";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import type { AuthShellUser } from "@/features/auth/auth-types";
import {
  MobileDayStreakOverlayProvider,
  useOptionalMobileDayStreakOverlay,
} from "@/app/components/mobile-day-streak-overlay-provider";

vi.mock("@/features/leaderboard/use-leaderboard", () => ({
  useLeaderboardData: () => ({ data: null }),
}));

const user = { id: "user-for-streak-reminder-test" } as AuthShellUser;

function ReminderTrigger({ onContinue }: { onContinue: () => void }) {
  const overlay = useOptionalMobileDayStreakOverlay();

  return (
    <button
      type="button"
      data-reminder-trigger
      onClick={() => overlay?.requestAutoOpenAfterQuizResult(onContinue)}
    >
      Trigger reminder
    </button>
  );
}

describe("MobileDayStreakOverlayProvider result reminder", () => {
  it("opens once per user and local day, then continues after the close animation", () => {
    vi.useFakeTimers();
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

    const firstContinue = vi.fn();
    const secondContinue = vi.fn();

    render(
      <LocaleProvider initialLocale="tr">
        <AuthSessionProvider user={user}>
          <ThemeProvider initialTheme="default-dark">
            <MobileDayStreakOverlayProvider>
              <ReminderTrigger onContinue={firstContinue} />
              <ReminderTrigger onContinue={secondContinue} />
            </MobileDayStreakOverlayProvider>
          </ThemeProvider>
        </AuthSessionProvider>
      </LocaleProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Trigger reminder" })[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(firstContinue).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Kapat" }));
    act(() => {
      vi.advanceTimersByTime(360);
    });
    expect(firstContinue).toHaveBeenCalledOnce();

    fireEvent.click(screen.getAllByRole("button", { name: "Trigger reminder" })[1]);
    expect(secondContinue).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/i18n/locale-provider";
import { MobileDayStreakMenu } from "@/app/components/mobile-day-streak-menu";

describe("MobileDayStreakMenu", () => {
  it("shows the current week, marks logged days, and opens the full calendar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <LocaleProvider initialLocale="tr">
        <ThemeProvider initialTheme="default-dark">
          <MobileDayStreakMenu
            open
            onClose={onClose}
            snapshot={{
              currentStreak: 4,
              today: "2026-09-15",
              loggedDates: ["2026-09-12", "2026-09-14", "2026-09-15"],
            }}
          />
        </ThemeProvider>
      </LocaleProvider>,
    );

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog");
    const currentStreak = document.querySelector<HTMLElement>("[data-day-streak-current-streak]");
    expect(dialog).toHaveAttribute("data-day-streak-content-ready", "false");
    expect(currentStreak).toHaveClass("day-streak-ui-pending");

    const backgroundVideo = document.querySelector<HTMLVideoElement>("[data-day-streak-background]");
    expect(backgroundVideo).toBeInTheDocument();
    fireEvent.ended(backgroundVideo!);

    await waitFor(() => expect(dialog).toHaveAttribute("data-day-streak-content-ready", "true"));

    expect(currentStreak).toHaveTextContent("4");
    expect(currentStreak).toHaveClass("day-streak-ui-enter");
    expect(currentStreak?.style.getPropertyValue("--day-streak-enter-delay")).toBe("80ms");
    expect(document.querySelectorAll("[data-day-streak-day]")).toHaveLength(7);
    expect(document.querySelector('[data-day-streak-day="2026-09-15"] svg')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "SERI TAKVIMI" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "SERI TAKVIMI" }));

    expect(document.querySelector("[data-day-streak-calendar-view]")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HAFTAYA DON" })).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: "Kapat" });
    await user.click(closeButton);
    await waitFor(() => expect(document.querySelector("[data-day-streak-calendar-view]")).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Kapat" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

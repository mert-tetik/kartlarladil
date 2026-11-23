import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeaderboardEntryRow } from "@/features/leaderboard/components/leaderboard-entry-row";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { LeaderboardEntry } from "@/features/leaderboard/leaderboard-types";

function createEntry(
  position: number,
  isViewer = false,
  rankIcon: LeaderboardEntry["rankIcon"] = "trophy",
): LeaderboardEntry {
  return {
    userId: `user-${position}`,
    position,
    displayName: `Learner ${position}`,
    profilePictureIndex: null,
    totalPoints: 100,
    streak: 0,
    medals: 0,
    rankIcon,
    isViewer,
  };
}

describe("LeaderboardEntryRow", () => {
  it("keeps row height consistent across ranks while widening badges for extra digits", () => {
    render(
      <LocaleProvider initialLocale="en">
        <LeaderboardEntryRow entry={createEntry(1)} mode="points" />
        <LeaderboardEntryRow entry={createEntry(100)} mode="points" />
        <LeaderboardEntryRow entry={createEntry(1_000)} mode="points" />
      </LocaleProvider>,
    );

    const firstRow = screen.getByText("Learner 1").closest<HTMLElement>("[data-leaderboard-entry-key]");
    const hundredthRow = screen.getByText("Learner 100").closest<HTMLElement>("[data-leaderboard-entry-key]");
    const thousandthRow = screen.getByText("Learner 1000").closest<HTMLElement>("[data-leaderboard-entry-key]");
    const firstBadge = within(firstRow!).getByText("1.").closest("[data-leaderboard-position-badge]");
    const hundredthBadge = within(hundredthRow!).getByText("100.").closest("[data-leaderboard-position-badge]");
    const thousandthBadge = within(thousandthRow!).getByText("1,000.").closest("[data-leaderboard-position-badge]");

    expect(firstBadge).toHaveStyle({ width: "3.45rem", height: "3.45rem" });
    expect(hundredthBadge).toHaveStyle({ width: "3.45rem", height: "3.45rem" });
    expect(thousandthBadge).toHaveStyle({ width: "4.05rem", height: "3.45rem" });
    expect(firstRow?.className).toBe(hundredthRow?.className);
    expect(hundredthRow?.className).toBe(thousandthRow?.className);
  });

  it("uses quiz-flow capsules and white points icons for all rows", () => {
    render(
      <LocaleProvider initialLocale="en">
        <LeaderboardEntryRow entry={createEntry(1)} mode="points" presentation="quiz-flow" />
        <LeaderboardEntryRow entry={createEntry(2, true, "graduation")} mode="points" presentation="quiz-flow" />
        <LeaderboardEntryRow entry={createEntry(3, true, "gem")} mode="points" presentation="quiz-flow" />
      </LocaleProvider>,
    );

    const regularRow = screen.getByText("Learner 1").closest<HTMLElement>("[data-leaderboard-entry-key]");
    const viewerRow = screen.getByText("Learner 2").closest<HTMLElement>("[data-leaderboard-entry-key]");
    const darkRankViewerName = screen.getByText("Learner 3");

    expect(regularRow).toHaveClass("bg-[var(--quiz-leaderboard-row-color)]");
    expect(regularRow?.style.getPropertyValue("--quiz-leaderboard-row-color")).toContain("color-mix");
    expect(viewerRow).toHaveClass(
      "bg-[var(--quiz-leaderboard-row-color)]",
      "ring-2",
      "ring-[var(--quiz-leaderboard-rank-color)]",
    );
    expect(viewerRow?.style.getPropertyValue("--quiz-leaderboard-rank-color")).toBe("#FAC13E");
    expect(viewerRow?.style.getPropertyValue("--quiz-leaderboard-row-color")).toBe("#FAC13E");
    expect(screen.getByText("Learner 1")).toHaveClass("text-base", "text-white");
    expect(screen.getByText("Learner 2")).toHaveClass("text-base", "text-black");
    expect(darkRankViewerName).toHaveClass("text-base", "text-white");
    expect(regularRow?.querySelector("span.size-11")).toBeInTheDocument();
    const regularPosition = within(regularRow!).getByText("1.");
    const regularPositionBadge = regularPosition.closest("[data-leaderboard-position-badge]");
    expect(regularPositionBadge).toHaveClass("bg-black/25", "text-white", "rounded-full");
    expect(regularPositionBadge?.querySelector('img[src="/ranks/rank1.webp"]')).toHaveClass("size-8");
    expect(regularPositionBadge).toHaveStyle({ height: "3.15rem" });
    expect(regularRow?.querySelector("img.size-10")).not.toBeInTheDocument();
    expect(within(regularRow!).getByText("100").parentElement).toHaveClass(
      "rounded-full",
      "bg-black/25",
      "text-white",
    );
    expect(regularRow?.querySelector('img[src="/score-icon.webp"]')).not.toHaveClass("brightness-0");
    expect(regularRow?.querySelector('img[src="/score-icon.webp"]')).not.toHaveClass("invert");
    const viewerPosition = within(viewerRow!).getByText("2.");
    const viewerPositionBadge = viewerPosition.closest("[data-leaderboard-position-badge]");
    expect(viewerPositionBadge).toHaveClass("bg-black/25", "text-white", "rounded-full");
    expect(viewerPositionBadge?.querySelector('img[src="/ranks/rank5.webp"]')).toHaveClass("size-8");
    expect(viewerRow?.querySelector("img.size-10")).not.toBeInTheDocument();
    expect(within(viewerRow!).getByText("100").parentElement).toHaveClass(
      "rounded-full",
      "bg-black/25",
      "text-white",
    );
    expect(viewerRow?.querySelector('img[src="/score-icon.webp"]')).toHaveClass("brightness-0", "invert");
  });

  it("pulses the viewer row with its rank badge during quiz-flow rank changes", () => {
    render(
      <LocaleProvider initialLocale="en">
        <LeaderboardEntryRow
          entry={createEntry(2, true, "graduation")}
          mode="points"
          presentation="quiz-flow"
          pulsePosition
        />
        <LeaderboardEntryRow
          entry={createEntry(3, false)}
          mode="points"
          presentation="quiz-flow"
          pulsePosition
        />
      </LocaleProvider>,
    );

    const viewerRow = screen.getByText("Learner 2").closest<HTMLElement>("[data-leaderboard-entry-key]");
    const otherRow = screen.getByText("Learner 3").closest<HTMLElement>("[data-leaderboard-entry-key]");

    expect(viewerRow).toHaveClass("animate-quiz-leaderboard-viewer-row-rank-pulse", "relative", "z-10");
    expect(within(viewerRow!).getByText("2.").closest("[data-leaderboard-position-badge]"))
      .toHaveClass("animate-quiz-leaderboard-rank-pulse");
    expect(otherRow).not.toHaveClass("animate-quiz-leaderboard-viewer-row-rank-pulse");
    expect(within(otherRow!).getByText("3.").closest("[data-leaderboard-position-badge]"))
      .toHaveClass("animate-quiz-leaderboard-rank-pulse");
  });
});

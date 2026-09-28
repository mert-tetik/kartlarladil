import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { getMissionCardBackground, MissionCard } from "./mission-card";
import type { MissionReward } from "@/features/missions/mission-types";

function missionCard(claiming: boolean) {
  return (
    <LocaleProvider initialLocale="en">
      <MissionCard
        missionId="learn_cards_2"
        index={1}
        type="learn_cards"
        requirement={3}
        progress={3}
        status="waiting"
        reward={{ kind: "points", amount: 75 }}
        onClaim={vi.fn()}
        onOpenDetails={vi.fn()}
        claiming={claiming}
      />
    </LocaleProvider>
  );
}

describe("MissionCard optimistic claim state", () => {
  it("uses the requested lime background for green gem rewards", () => {
    expect(getMissionCardBackground(0, false, {
      kind: "gems",
      gemType: "green",
      amount: 2,
      pointEquivalent: 40,
    })).toContain("#73E32D");
  });

  it("shows the selected gem type and its exact mission reward amount", () => {
    render(
      <LocaleProvider initialLocale="en">
        <MissionCard
          missionId="game_level_memory_3"
          index={2}
          type="game_level"
          requirement={3}
          progress={3}
          status="waiting"
          reward={{ kind: "gems", gemType: "green", amount: 4, pointEquivalent: 75 }}
          onClaim={vi.fn()}
          onOpenDetails={vi.fn()}
          claiming={false}
        />
      </LocaleProvider>,
    );

    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("data-mission-reward-kind", "gems");
    expect(card).toHaveAttribute("data-mission-reward-gem-type", "green");
    expect(card).toHaveAttribute("data-mission-reward-gem-amount", "4");
    expect(card).toHaveTextContent("+4");
    expect(card.querySelector("[data-mission-gem-amount-label]")).toHaveClass("text-[2.125rem]");
    expect(card.querySelector("img")).toBeInTheDocument();
  });

  it("shows claimed immediately while the reward request is pending", () => {
    render(missionCard(true));

    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("data-mission-status", "claimed");
    expect(card).toHaveClass("mission-card--claimed", "cursor-wait");
    expect(card.querySelector("[data-mission-claimed-label]")).toBeInTheDocument();
    expect(card.querySelector("[data-mission-claimed-wash]")).toHaveClass("mission-card-claimed-wash--visible");
    expect(card).toHaveAttribute("tabindex", "-1");
  });

  it("returns to waiting when the failed request is rolled back", () => {
    const view = render(missionCard(true));
    view.rerender(missionCard(false));

    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("data-mission-status", "waiting");
    expect(card).not.toHaveClass("mission-card--claimed", "cursor-wait");
    expect(card.querySelector("[data-mission-claimed-label]")).not.toBeInTheDocument();
    expect(card.querySelector("[data-mission-claimed-wash]")).not.toHaveClass("mission-card-claimed-wash--visible");
    expect(card).toHaveAttribute("tabindex", "0");
  });
});

describe("MissionCard locked reward artwork", () => {
  it.each([
    [{ kind: "points", amount: 75 }, "/missions/mission-points-lock-v1.png", "h-[7.2rem]"],
    [{ kind: "gems", gemType: "blue", amount: 2, pointEquivalent: 10 }, "/missions/mission-blue-gem-lock-v1.png", "h-[7.2rem]"],
    [{ kind: "gems", gemType: "green", amount: 2, pointEquivalent: 40 }, "/missions/mission-green-gem-lock-v1.png", "h-[7.2rem]"],
    [{ kind: "gems", gemType: "purple", amount: 2, pointEquivalent: 80 }, "/missions/mission-purple-gem-lock-v1.png", "h-[7.2rem]"],
    [{ kind: "chest", tier: "wood" }, "/missions/mission-lock-icon-v3.png", "h-[6rem]"],
  ] as const)("uses the matching lock art for %o", (reward, imageSrc, imageHeightClass) => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <MissionCard
          missionId="locked_mission"
          index={1}
          type="learn_cards"
          requirement={3}
          progress={1}
          status="locked"
          reward={reward as MissionReward}
          onClaim={vi.fn()}
          onOpenDetails={vi.fn()}
          claiming={false}
        />
      </LocaleProvider>,
    );

    const lockImage = container.querySelector("img[data-mission-lock-asset]");
    expect(lockImage).toHaveAttribute("data-mission-lock-asset", imageSrc);
    expect(lockImage).toHaveClass(imageHeightClass);
  });
});

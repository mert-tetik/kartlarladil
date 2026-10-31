import { useEffect, useState } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { MissionRewardAnimationMode } from "../mission-reward-queue";
import { MissionRewardOverlay } from "./mission-reward-overlay";

vi.mock("@/features/progress/progress-client", () => ({
  useProgressStats: () => ({ stats: { totalPoints: 1000 } }),
}));

vi.mock("@/features/auth/auth-client", () => ({
  useOptionalAuthSession: () => ({
    user: { profile: { blueGems: 7, greenGems: 3, purpleGems: 1 } },
  }),
}));

vi.mock("@/features/progress/components/reward-scatter", async () => {
  const React = await import("react");

  return {
    RewardScatter: (props: {
      points?: unknown;
      gems?: unknown;
      onPointsStart?: () => void;
      onPointsArrive?: (awardedTotal: number) => void;
      onPointsComplete?: () => void;
      onGemsStart?: () => void;
      onGemArrive?: (type: "blue" | "green" | "purple", amountAwarded: number) => void;
      onGemsComplete?: () => void;
    }) => {
      React.useEffect(() => {
        if (props.points) {
          props.onPointsStart?.();
          props.onPointsArrive?.(25);
          props.onPointsComplete?.();
        }
        if (props.gems) {
          props.onGemsStart?.();
          props.onGemArrive?.("blue", 2);
          props.onGemsComplete?.();
        }
      }, []);

      return null;
    },
  };
});

const INITIAL_MODES: MissionRewardAnimationMode[] = [
  { missionId: "points-pending", kind: "points", amount: 25, source: new DOMRect(10, 10, 20, 20) },
  { missionId: "gems-pending", kind: "gems", gemType: "blue", amount: 2, source: new DOMRect(10, 10, 20, 20) },
];

function PendingMissionClaimHarness() {
  const [modes, setModes] = useState(INITIAL_MODES);

  return (
    <MissionRewardOverlay
      modes={modes}
      onComplete={(missionId) => {
        setModes((current) => current.map((mode) => (
          mode.missionId === missionId ? { ...mode, animationComplete: true } : mode
        )));
      }}
    />
  );
}

describe("mission reward overlay arrivals", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps arrived score and gems visible after flights finish while their claims are pending", () => {
    render(
      <LocaleProvider initialLocale="en">
        <PendingMissionClaimHarness />
      </LocaleProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const stack = document.body.querySelector("[data-mission-points-flight-stack]");
    expect(stack).toHaveAttribute("data-active-point-reward-count", "0");
    expect(stack).toHaveAttribute("data-active-gem-reward-count", "0");

    const pointsText = stack?.querySelector("[data-main-points-display] .text-lg.font-bold")?.textContent;
    expect(pointsText?.replace(/\D/g, "")).toBe("1025");

    const blueGemText = stack?.querySelector('[data-reward-gem-target="blue"] span')?.textContent;
    expect(blueGemText?.replace(/\D/g, "")).toBe("9");
  });
});

import { act, fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { QuizStreakCelebrationView } from "./quiz-streak-celebration-view";

const mocks = vi.hoisted(() => ({
  playSoundEffect: vi.fn(),
  vibrate: vi.fn(),
}));

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: mocks.playSoundEffect,
}));

vi.mock("@/lib/vibration", () => ({
  vibrate: mocks.vibrate,
}));

describe("QuizStreakCelebrationView", () => {
  function renderView(props: ComponentProps<typeof QuizStreakCelebrationView>) {
    return render(
      <LocaleProvider initialLocale="tr">
        <QuizStreakCelebrationView {...props} />
      </LocaleProvider>,
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mocks.playSoundEffect.mockReset();
    mocks.vibrate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the streak text immediately without a video or entrance animation", () => {
    renderView({ streak: 5, enterWithCss: true });

    const view = document.querySelector("[data-streak-celebration-view]");
    const label = document.querySelector("[data-streak-count-label]");

    expect(view).toHaveClass("quiz-flow-enter-right");
    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(label).toHaveTextContent("ÜST ÜSTE 5");
    expect(label).toHaveClass("animate-streak-count-idle");
    expect(label).not.toHaveClass("animate-streak-count-exit");
  });

  it("plays the tap feedback, starts particles, scales out, and completes after 700ms", () => {
    const onComplete = vi.fn();
    renderView({ streak: 10, onComplete });
    const view = document.querySelector("[data-streak-celebration-view]")!;

    fireEvent.pointerUp(view, { pointerType: "touch" });

    expect(mocks.playSoundEffect).toHaveBeenCalledWith("streak-count-reveal");
    expect(mocks.vibrate).toHaveBeenCalledWith("streak-reward-tap");
    expect(document.querySelector("[data-streak-particle-layer]")).toBeInTheDocument();
    expect(document.querySelector("[data-streak-particle-layer]")?.parentElement).not.toBe(
      document.querySelector("[data-streak-count-label]"),
    );
    expect(document.querySelector("[data-streak-count-label]")).toHaveClass("animate-streak-count-exit");
    expect(document.querySelector("[data-streak-count-label]")).toHaveAttribute(
      "data-streak-count-state",
      "exiting",
    );
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(699);
    });
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("fires the optional press callback immediately without waiting for completion", () => {
    const onPress = vi.fn();
    const onComplete = vi.fn();
    renderView({ streak: 5, onPress, onComplete });
    const view = document.querySelector("[data-streak-celebration-view]")!;

    fireEvent.pointerUp(view, { pointerType: "touch" });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("reveals the point target and starts the reward scatter on the first tap", () => {
    renderView({ streak: 5, rewardPoints: 20, totalPoints: 100 });
    const view = document.querySelector("[data-streak-celebration-view]")!;
    const pointsHud = document.querySelector("[data-streak-reward-points]")!;

    expect(pointsHud).toHaveClass("opacity-0");
    fireEvent.pointerUp(view, { pointerType: "touch" });

    expect(pointsHud).toHaveClass("animate-streak-reward-hud-enter");
    expect(pointsHud).toHaveAttribute("data-streak-reward-points");
  });

  it("renders the three gem displays with the reward HUD after the first tap", () => {
    renderView({
      streak: 5,
      rewardPoints: 20,
      totalPoints: 100,
      gemRewards: [
        { type: "blue", amount: 1 },
        { type: "green", amount: 1 },
        { type: "purple", amount: 1 },
      ],
      gemBalances: { blue: 51, green: 31, purple: 16 },
    });
    const view = document.querySelector("[data-streak-celebration-view]")!;

    fireEvent.pointerUp(view, { pointerType: "touch" });

    const hud = document.querySelector('[data-reward-gem-hud-role="reward"]');
    expect(hud).toBeInTheDocument();
    expect(hud?.querySelector('[data-reward-gem-target="blue"]')).toHaveTextContent("50");
    expect(hud?.querySelector('[data-reward-gem-target="green"]')).toHaveTextContent("30");
    expect(hud?.querySelector('[data-reward-gem-target="purple"]')).toHaveTextContent("15");
  });

  it("does not leave the reward screen on the fixed 700ms timer", () => {
    const onComplete = vi.fn();
    renderView({ streak: 5, rewardPoints: 20, totalPoints: 100, onComplete });
    const view = document.querySelector("[data-streak-celebration-view]")!;

    fireEvent.pointerUp(view, { pointerType: "touch" });

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("ignores additional taps after the first press", () => {
    const onComplete = vi.fn();
    renderView({ streak: 15, onComplete });
    const view = document.querySelector("[data-streak-celebration-view]")!;

    fireEvent.pointerUp(view, { pointerType: "touch" });
    fireEvent.pointerUp(view, { pointerType: "touch" });

    expect(mocks.playSoundEffect).toHaveBeenCalledTimes(1);
    expect(mocks.vibrate).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

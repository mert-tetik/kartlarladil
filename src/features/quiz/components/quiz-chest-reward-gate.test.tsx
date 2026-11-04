import { act, render } from "@testing-library/react";
import { vi } from "vitest";
import { QuizChestRewardGate } from "@/features/quiz/components/quiz-chest-reward-gate";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";
import { LocaleProvider } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

vi.mock("@/features/quiz/components/chest-icon", () => ({
  ChestIcon: () => <div data-testid="chest-icon" />,
}));
vi.mock("@/features/quiz/components/chest-opening-view", () => ({
  ChestOpeningView: () => <div data-testid="chest-opening" />,
}));
vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: vi.fn() }));
vi.mock("@/lib/vibration", () => ({ vibrate: vi.fn() }));

describe("QuizChestRewardGate", () => {
  it("plays a single solid haptic when the chest lands after its delayed drop", () => {
    vi.useFakeTimers();
    const view = render(
      <LocaleProvider initialLocale="en">
        <QuizChestRewardGate
          tier={CHEST_TIERS[0]}
          totalPoints={0}
          accuracy={80}
          missedReason=""
          missedProgress=""
          onComplete={vi.fn()}
        />
      </LocaleProvider>,
    );

    try {
      expect(view.container.querySelector(".quiz-chest-reward-drop")).not.toBeNull();
      act(() => vi.advanceTimersByTime(779));
      expect(vibrate).not.toHaveBeenCalled();
      expect(playSoundEffect).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(1));

      expect(vibrate).toHaveBeenCalledTimes(1);
      expect(vibrate).toHaveBeenCalledWith("chest-land");
      expect(playSoundEffect).toHaveBeenCalledTimes(1);
      expect(playSoundEffect).toHaveBeenCalledWith("chest-crack");
      expect(view.container.querySelector(".quiz-chest-reward-drop")).toBeNull();
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  });
});

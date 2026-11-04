import { act, render } from "@testing-library/react";
import { vi } from "vitest";
import { QuizCompletionProgressView } from "@/features/quiz/components/quiz-completion-progress-view";
import { LocaleProvider } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: vi.fn() }));
vi.mock("@/lib/vibration", () => ({ vibrate: vi.fn() }));

describe("QuizCompletionProgressView", () => {
  it("enters from the right when the quiz flow requests a CSS transition", () => {
    render(
      <LocaleProvider initialLocale="en">
        <QuizCompletionProgressView enterWithCss onComplete={vi.fn()} />
      </LocaleProvider>,
    );

    expect(document.querySelector("[data-quiz-completion-progress]")).toHaveClass(
      "quiz-flow-enter-right",
    );
  });

  it("vibrates when the completion particles appear", () => {
    vi.useFakeTimers();
    const requestAnimationFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const cancelAnimationFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    try {
      render(
        <LocaleProvider initialLocale="en">
          <QuizCompletionProgressView onComplete={vi.fn()} />
        </LocaleProvider>,
      );

      expect(document.querySelectorAll(".quiz-completion-particle")).toHaveLength(0);
      act(() => vi.advanceTimersByTime(1_280));

      expect(document.querySelectorAll(".quiz-completion-particle").length).toBeGreaterThan(0);
      expect(vibrate).toHaveBeenCalledTimes(1);
      expect(vibrate).toHaveBeenCalledWith("confetti");
      expect(playSoundEffect).not.toHaveBeenCalledWith("quiz-completion-progress-pop");

      act(() => vi.advanceTimersByTime(120));
      expect(playSoundEffect).toHaveBeenCalledWith("quiz-completion-progress-pop");
    } finally {
      requestAnimationFrame.mockRestore();
      cancelAnimationFrame.mockRestore();
      vi.useRealTimers();
    }
  });
});

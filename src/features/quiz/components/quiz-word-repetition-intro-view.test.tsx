import { act, fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { QuizWordRepetitionIntroView } from "@/features/quiz/components/quiz-word-repetition-intro-view";

function renderIntro(onComplete = vi.fn()) {
  const view = render(
    <LocaleProvider initialLocale="tr">
      <QuizWordRepetitionIntroView enterWithCss={false} onComplete={onComplete} />
    </LocaleProvider>,
  );

  return { ...view, onComplete };
}

describe("QuizWordRepetitionIntroView", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reveals the character, then types the localized speech bubble", () => {
    vi.useFakeTimers();
    renderIntro();

    const intro = screen.getByRole("button", { name: "Hadi hatalarımızın üzerinden geçelim" });
    expect(intro).toHaveAttribute("data-quiz-word-repetition-intro");
    expect(document.querySelector(".quiz-word-repetition-intro-bubble")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(560);
    });
    expect(document.querySelector(".quiz-word-repetition-intro-bubble")).toBeInTheDocument();
    expect(screen.queryByText("Hadi hatalarımızın üzerinden geçelim")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(360);
    });
    act(() => {
      vi.advanceTimersByTime(42 * Array.from("Hadi hatalarımızın üzerinden geçelim").length);
    });
    expect(screen.getByText("Hadi hatalarımızın üzerinden geçelim")).toBeInTheDocument();
  });

  it("skips immediately on a double tap before the intro finishes", () => {
    vi.useFakeTimers();
    const { onComplete } = renderIntro();
    const intro = screen.getByRole("button", { name: "Hadi hatalarımızın üzerinden geçelim" });

    fireEvent.doubleClick(intro);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("allows a single tap after typing", () => {
    vi.useFakeTimers();
    const { onComplete } = renderIntro();
    const introText = "Hadi hatalarımızın üzerinden geçelim";
    const intro = screen.getByRole("button", { name: introText });

    act(() => {
      vi.advanceTimersByTime(560);
    });
    act(() => {
      vi.advanceTimersByTime(360);
    });
    act(() => {
      vi.advanceTimersByTime(42 * Array.from(introText).length);
    });
    fireEvent.pointerUp(intro, { pointerType: "touch" });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("auto-skips two seconds after typing finishes", () => {
    vi.useFakeTimers();
    const { onComplete } = renderIntro();
    const introText = "Hadi hatalarımızın üzerinden geçelim";

    act(() => {
      vi.advanceTimersByTime(560);
    });
    act(() => {
      vi.advanceTimersByTime(360);
    });
    act(() => {
      vi.advanceTimersByTime(42 * Array.from(introText).length);
    });
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

import { act, fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizStreakCelebrationView } from "./quiz-streak-celebration-view";
import { LocaleProvider } from "@/i18n/locale-provider";

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
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("keeps the first video frame paused until the entrance transition ends", () => {
    const onComplete = vi.fn();
    renderView({ streak: 5, enterWithCss: true, onComplete });

    const view = document.querySelector("[data-streak-celebration-view]");
    const video = document.querySelector("video");
    const play = HTMLMediaElement.prototype.play as unknown as ReturnType<typeof vi.spyOn>;

    expect(view).toHaveClass("quiz-flow-enter-right");
    expect(video).toHaveAttribute("src", "/quiz/streak-animation.mp4");
    expect(play).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(359);
    });
    expect(play).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(play).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("shows the localized streak label at the middle of the video and waits after it ends", () => {
    const onComplete = vi.fn();
    renderView({ streak: 5, onComplete });
    const video = document.querySelector("video") as HTMLVideoElement;

    act(() => {
      vi.advanceTimersByTime(360);
    });

    Object.defineProperty(video, "duration", { configurable: true, value: 1.555 });
    Object.defineProperty(video, "currentTime", { configurable: true, value: 0.8 });
    fireEvent.timeUpdate(video);
    expect(document.querySelector("[data-streak-count-label]")).toHaveTextContent("ÜST ÜSTE 5");

    fireEvent.ended(video);
    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("skips the video hold on a double tap", () => {
    const onComplete = vi.fn();
    renderView({ streak: 10, onComplete });
    const view = document.querySelector("[data-streak-celebration-view]")!;

    fireEvent.pointerUp(view, { pointerType: "touch" });
    fireEvent.pointerUp(view, { pointerType: "touch" });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

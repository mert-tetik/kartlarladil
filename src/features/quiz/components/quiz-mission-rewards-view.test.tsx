import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { QuizMissionRewardsView } from "./quiz-mission-rewards-view";

vi.mock("@/features/missions/components/mission-list-content", () => ({
  MissionListContent: (props: Record<string, unknown>) => {
    const onPendingChange = props.onPendingChange as ((pending: boolean) => void) | undefined;

    return (
      <div
        data-testid="shared-mission-list"
        data-test-mode={String(props.testMode)}
        data-claimable-count={String(props.claimableCount)}
        data-claimable-first={String(props.claimableFirst)}
        data-visible={String(props.visible)}
      >
        <button type="button" onClick={() => onPendingChange?.(true)}>Claim test reward</button>
        <button type="button" onClick={() => onPendingChange?.(false)}>Finish test reward</button>
      </div>
    );
  },
}));

afterEach(() => {
  vi.useRealTimers();
});

const originalAnimateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "animate");

afterEach(() => {
  if (originalAnimateDescriptor) {
    Object.defineProperty(Element.prototype, "animate", originalAnimateDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, "animate");
  }
});

function renderMissionRewards(props?: Partial<ComponentProps<typeof QuizMissionRewardsView>>) {
  const onInitialClaimableAvailabilityResolved = vi.fn();
  const onContinue = vi.fn();
  const onActionPress = vi.fn();

  render(
    <LocaleProvider initialLocale="en">
      <QuizMissionRewardsView
        visible
        testMode
        onInitialClaimableAvailabilityResolved={onInitialClaimableAvailabilityResolved}
        onContinue={onContinue}
        onActionPress={onActionPress}
        {...props}
      />
    </LocaleProvider>,
  );

  return { onInitialClaimableAvailabilityResolved, onContinue, onActionPress };
}

describe("QuizMissionRewardsView", () => {
  it("uses the shared mission list with four claimable test tasks", () => {
    const { onInitialClaimableAvailabilityResolved } = renderMissionRewards();

    expect(screen.getByRole("heading", { name: "Claim mission rewards" })).toBeInTheDocument();
    expect(document.querySelector("[data-quiz-mission-rewards]"))
      .toHaveClass(
        "pb-[calc(3.5rem_+_50px_+_env(safe-area-inset-bottom))]",
        "sm:pb-[calc(4rem_+_50px_+_env(safe-area-inset-bottom))]",
      );
    expect(document.querySelector("[data-quiz-mission-rewards-title]"))
      .toHaveClass("text-[2.1rem]", "sm:text-[2.625rem]", "pt-[54px]", "pb-5", "translate-y-[50px]");
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(document.querySelector("[data-quiz-mission-rewards-list]"))
      .toHaveClass("flex-1", "mb-0", "translate-y-[10px]", "scale-[0.84]", "origin-center");
    const footer = document.querySelector("[data-quiz-mission-rewards-footer]");
    expect(footer).toBeInTheDocument();
    expect(footer?.tagName).toBe("DIV");
    expect(footer)
      .toHaveClass("absolute", "bottom-[40px]");
    expect(screen.getByTestId("shared-mission-list")).toHaveAttribute("data-test-mode", "true");
    expect(screen.getByTestId("shared-mission-list")).toHaveAttribute("data-claimable-count", "4");
    expect(screen.getByTestId("shared-mission-list")).toHaveAttribute("data-claimable-first", "true");
    expect(screen.getByTestId("shared-mission-list")).toHaveAttribute("data-visible", "true");
    expect(onInitialClaimableAvailabilityResolved).toHaveBeenCalledWith(true);
  });

  it("stagger-scales the UI in top-to-bottom and waits for reverse exit animations", async () => {
    const animationFinishers: Array<() => void> = [];
    const animationInputs: Array<{
      element: HTMLElement;
      keyframes: Keyframe[] | PropertyIndexedKeyframes;
      options?: KeyframeAnimationOptions;
    }> = [];
    const animateMock = vi.fn(function (
      this: HTMLElement,
      keyframes: Keyframe[] | PropertyIndexedKeyframes,
      options?: KeyframeAnimationOptions,
    ) {
      animationInputs.push({ element: this, keyframes, options });
      let resolveFinished!: (animation: Animation) => void;
      const finished = new Promise<Animation>((resolve) => {
        resolveFinished = resolve;
      });
      animationFinishers.push(() => resolveFinished({} as Animation));
      return { finished, cancel: vi.fn() } as unknown as Animation;
    });
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: animateMock,
    });

    const { onContinue, onActionPress } = renderMissionRewards();
    const root = document.querySelector("[data-quiz-mission-rewards]");

    expect(root).toHaveAttribute("data-transition-state", "entering");
    expect(root).not.toHaveClass("quiz-flow-enter-right", "quiz-flow-exit-left");
    expect(animateMock).toHaveBeenCalledTimes(3);
    expect(animationInputs.map(({ element }) => element.dataset)).toEqual([
      expect.objectContaining({ quizMissionRewardsTitle: "true" }),
      expect.objectContaining({ quizMissionRewardsList: "true" }),
      expect.objectContaining({ quizMissionRewardsFooter: "true" }),
    ]);
    expect(animationInputs.map(({ options }) => options?.delay)).toEqual([0, 100, 200]);
    expect(animationInputs[0]?.keyframes).toEqual([
      { transform: "scale(0)" },
      { transform: "scale(1)" },
    ]);

    vi.useFakeTimers();
    const continueButton = screen.getByRole("button", { name: "Continue" });

    fireEvent.click(screen.getByRole("button", { name: "Claim test reward" }));
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Finish test reward" }));
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    expect(onActionPress).toHaveBeenCalledOnce();
    expect(root).toHaveAttribute("data-transition-state", "exiting");
    expect(root).not.toHaveClass("quiz-flow-enter-right", "quiz-flow-exit-left");
    expect(animateMock).toHaveBeenCalledTimes(6);
    expect(animationInputs.slice(3).map(({ element }) => element.dataset)).toEqual([
      expect.objectContaining({ quizMissionRewardsFooter: "true" }),
      expect.objectContaining({ quizMissionRewardsList: "true" }),
      expect.objectContaining({ quizMissionRewardsTitle: "true" }),
    ]);
    expect(animationInputs.slice(3).map(({ options }) => options?.delay)).toEqual([0, 100, 200]);
    expect(animationInputs[3]?.keyframes).toEqual([
      { transform: "scale(1)" },
      { transform: "scale(0)" },
    ]);
    expect(onContinue).not.toHaveBeenCalled();

    await act(async () => {
      animationFinishers[3]?.();
      animationFinishers[4]?.();
      await Promise.resolve();
    });
    expect(onContinue).not.toHaveBeenCalled();

    await act(async () => {
      animationFinishers[5]?.();
      await Promise.resolve();
    });

    expect(onContinue).toHaveBeenCalledOnce();
  });
});

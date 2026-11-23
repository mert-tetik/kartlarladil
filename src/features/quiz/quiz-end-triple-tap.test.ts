import { describe, expect, it, vi } from "vitest";
import {
  activateQuizEndPrimaryActionOnTripleTap,
  createQuizEndTripleTapState,
} from "@/features/quiz/quiz-end-triple-tap";

describe("quiz end triple-tap primary action", () => {
  it("clicks the enabled continue button once on the third tap", () => {
    const screen = document.createElement("div");
    const button = document.createElement("button");
    button.dataset.quizEndContinue = "";
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    screen.append(button);
    const state = createQuizEndTripleTapState();

    expect(activateQuizEndPrimaryActionOnTripleTap(state, screen, 100)).toBe(false);
    expect(activateQuizEndPrimaryActionOnTripleTap(state, screen, 250)).toBe(false);
    expect(activateQuizEndPrimaryActionOnTripleTap(state, screen, 400)).toBe(true);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not activate a disabled, locked, or hidden continue button", () => {
    const screen = document.createElement("div");
    const button = document.createElement("button");
    button.dataset.quizEndContinue = "";
    button.disabled = true;
    screen.append(button);
    const state = createQuizEndTripleTapState();

    activateQuizEndPrimaryActionOnTripleTap(state, screen, 0);
    activateQuizEndPrimaryActionOnTripleTap(state, screen, 100);
    expect(activateQuizEndPrimaryActionOnTripleTap(state, screen, 200)).toBe(false);

    button.disabled = false;
    button.dataset.quizEndContinueLocked = "true";
    activateQuizEndPrimaryActionOnTripleTap(state, screen, 300);
    activateQuizEndPrimaryActionOnTripleTap(state, screen, 400);
    expect(activateQuizEndPrimaryActionOnTripleTap(state, screen, 500)).toBe(false);

    delete button.dataset.quizEndContinueLocked;
    button.setAttribute("aria-hidden", "true");
    activateQuizEndPrimaryActionOnTripleTap(state, screen, 600);
    activateQuizEndPrimaryActionOnTripleTap(state, screen, 700);
    expect(activateQuizEndPrimaryActionOnTripleTap(state, screen, 800)).toBe(false);
  });

  it("restarts the tap sequence when the screen changes or the window expires", () => {
    const firstScreen = document.createElement("div");
    const secondScreen = document.createElement("div");
    const button = document.createElement("button");
    const onClick = vi.fn();
    button.dataset.quizEndContinue = "";
    button.addEventListener("click", onClick);
    secondScreen.append(button);
    const state = createQuizEndTripleTapState();

    expect(activateQuizEndPrimaryActionOnTripleTap(state, firstScreen, 0)).toBe(false);
    expect(activateQuizEndPrimaryActionOnTripleTap(state, firstScreen, 200)).toBe(false);
    expect(activateQuizEndPrimaryActionOnTripleTap(state, secondScreen, 250)).toBe(false);
    expect(activateQuizEndPrimaryActionOnTripleTap(state, secondScreen, 400)).toBe(false);
    expect(activateQuizEndPrimaryActionOnTripleTap(state, secondScreen, 901)).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("prefers an explicitly marked action over the screen's continue button", () => {
    const screen = document.createElement("div");
    const continueButton = document.createElement("button");
    const primaryAction = document.createElement("button");
    const onContinue = vi.fn();
    const onPrimaryAction = vi.fn();
    continueButton.dataset.quizEndContinue = "";
    primaryAction.dataset.quizEndTripleTapAction = "";
    continueButton.addEventListener("click", onContinue);
    primaryAction.addEventListener("click", onPrimaryAction);
    screen.append(continueButton, primaryAction);
    const state = createQuizEndTripleTapState();

    activateQuizEndPrimaryActionOnTripleTap(state, screen, 0);
    activateQuizEndPrimaryActionOnTripleTap(state, screen, 100);
    expect(activateQuizEndPrimaryActionOnTripleTap(state, screen, 200)).toBe(true);
    expect(onPrimaryAction).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();
  });
});

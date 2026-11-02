import { render } from "@testing-library/react";
import { LocaleProvider } from "@/i18n/locale-provider";
import { createElement, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  getAdditionalCardsNeededForChest,
  getQuizCountOptions,
  QuizCountSelection,
} from "@/features/quiz/components/quiz-count-selection";

vi.mock("@/features/quiz/components/quiz-speech-bubble", () => ({
  getRandomQuizCharacter: () => null,
  QuizSpeechBubble: () => null,
}));

vi.mock("@/features/quiz/components/chest-icon", () => ({
  ChestIcon: () => null,
}));

describe("getQuizCountOptions", () => {
  it("uses all available cards for the quick option when fewer than ten exist", () => {
    expect(getQuizCountOptions(3)).toEqual([3, 20, 30, 50]);
  });

  it("keeps the standard options when ten or more cards exist", () => {
    expect(getQuizCountOptions(10)).toEqual([10, 20, 30, 50]);
    expect(getQuizCountOptions(24)).toEqual([10, 20, 30, 50]);
  });
});

describe("getAdditionalCardsNeededForChest", () => {
  it("returns the number of cards needed to reach the first chest threshold", () => {
    expect(getAdditionalCardsNeededForChest(3)).toBe(7);
    expect(getAdditionalCardsNeededForChest(9)).toBe(1);
  });

  it("does not show a requirement once ten cards are available", () => {
    expect(getAdditionalCardsNeededForChest(10)).toBe(0);
    expect(getAdditionalCardsNeededForChest(24)).toBe(0);
  });
});

describe("QuizCountSelection loading state", () => {
  it("shows a spinner beside each option and disables them while questions are prepared", () => {
    const renderSelection = (preparing: boolean) =>
      createElement(
        LocaleProvider,
        { initialLocale: "en" } as ComponentProps<typeof LocaleProvider>,
        createElement(QuizCountSelection, {
          mode: "active",
          availableCount: 50,
          preparing,
          onSelect: () => undefined,
        }),
      );
    const { container, getAllByRole, rerender } = render(
      renderSelection(true),
    );

    expect(getAllByRole("button")).toHaveLength(4);
    expect(getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(container.querySelectorAll("svg.animate-spin")).toHaveLength(4);

    rerender(renderSelection(false));

    expect(getAllByRole("button").every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
    expect(container.querySelectorAll("svg.animate-spin")).toHaveLength(0);
  });
});

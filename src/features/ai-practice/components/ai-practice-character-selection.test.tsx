import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiPracticeCharacterSelection } from "@/features/ai-practice/components/ai-practice-character-selection";
import { getAiPracticeCharacters } from "@/features/ai-practice/ai-practice-data";
import { LocaleProvider } from "@/i18n/locale-provider";

describe("AiPracticeCharacterSelection", () => {
  it("renders its character list inside the mobile viewport container", () => {
    render(
      <LocaleProvider initialLocale="en">
        <AiPracticeCharacterSelection language="en" locale="en" tier="A1" />
      </LocaleProvider>,
    );

    const container = document.querySelector("[data-ai-practice-character-container]");
    const list = document.querySelector("[data-ai-practice-character-list]");

    expect(container).toHaveClass("max-lg:flex-1", "max-lg:h-full");
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(getAiPracticeCharacters().length);
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LANDING_CARD_LANGUAGE_KEY } from "@/app/components/landing-card-language";
import { AiPracticeCharacterSelection } from "@/features/ai-practice/components/ai-practice-character-selection";
import { getAiPracticeCharacters } from "@/features/ai-practice/ai-practice-data";
import { LocaleProvider } from "@/i18n/locale-provider";

const defaultMatchMedia = window.matchMedia;

describe("AiPracticeCharacterSelection", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.matchMedia = defaultMatchMedia;
  });

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

  it("uses each character's darkened chat background behind the selection portrait", () => {
    render(
      <LocaleProvider initialLocale="en">
        <AiPracticeCharacterSelection language="en" locale="en" tier="A1" />
      </LocaleProvider>,
    );

    const claraBackground = screen.getByRole("link", { name: /clara/i }).querySelector("[style]");
    const noraBackground = screen.getByRole("link", { name: /nora/i }).querySelector("[style]");
    const leoBackground = screen.getByRole("link", { name: /leo/i }).querySelector("[style]");

    expect(claraBackground?.getAttribute("style")).toContain("gentle-companion.jpg");
    expect(noraBackground?.getAttribute("style")).toContain("study-buddy.jpg");
    expect(leoBackground?.getAttribute("style")).toContain("sleepy-student.webp");
  });

  it("uses the landing card language when the mobile character selection first opens", async () => {
    window.localStorage.setItem(LANDING_CARD_LANGUAGE_KEY, "es");
    window.matchMedia = () => ({ matches: true }) as MediaQueryList;

    render(
      <LocaleProvider initialLocale="en">
        <AiPracticeCharacterSelection language="en" locale="en" tier="A1" />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(document.querySelector("[data-ai-practice-language-button]")).toHaveTextContent("Spanish");
    });
  });
});

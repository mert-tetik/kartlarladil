import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { LANDING_CARD_LANGUAGE_KEY } from "@/app/components/landing-card-language";
import { AiPracticeCharacterSelection } from "@/features/ai-practice/components/ai-practice-character-selection";
import { getAiPracticeCharacters } from "@/features/ai-practice/ai-practice-data";
import { getAiPracticeScenarios } from "@/features/ai-practice/ai-practice-scenarios";
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

  it("switches to situation cards that keep their character portraits", async () => {
    const user = userEvent.setup();

    render(
      <LocaleProvider initialLocale="en">
        <AiPracticeCharacterSelection language="en" locale="en" tier="A1" />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Situations" }));

    expect(document.querySelector("[data-ai-practice-character-list]")).not.toBeInTheDocument();
    expect(document.querySelector("[data-ai-practice-scenario-list]")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(getAiPracticeScenarios().length);
    expect(screen.getByRole("link", { name: /Order at a restaurant/i })).toHaveAttribute(
      "href",
      expect.stringContaining("mode=scenario"),
    );
    expect(screen.getByText("With Restaurant server")).toBeInTheDocument();
    expect(screen.queryByText("Role-play")).not.toBeInTheDocument();
    expect(screen.getByText("With Random citizen")).toBeInTheDocument();
    expect(screen.getByText("With Random girl")).toBeInTheDocument();
  });

  it("keeps situation cards from navigating while subscription access is unknown", async () => {
    const user = userEvent.setup();

    render(
      <LocaleProvider initialLocale="en">
        <AiPracticeCharacterSelection language="en" locale="en" tier="A1" />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Situations" }));

    const scenarioLinks = screen.getAllByRole("link");
    expect(scenarioLinks).toHaveLength(getAiPracticeScenarios().length);
    expect(scenarioLinks.every((link) => link.getAttribute("aria-disabled") === "true")).toBe(true);
  });
});

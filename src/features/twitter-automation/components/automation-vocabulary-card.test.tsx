import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutomationVocabularyCard } from "./automation-vocabulary-card";
import type { VocabularyCard } from "@/types/domain";

vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "en" }),
  useT: () => (key: string) => key === "cards.flip" ? "Click to flip" : key,
}));

vi.mock("@/components/score-icon", () => ({
  ScoreIcon: () => <span data-testid="score-icon" />,
}));

const card = {
  id: "automation-card-test",
  sourceKey: "automation-card-test",
  englishKey: "komorebi",
  language: "ja",
  tier: "A2",
  termKind: "word",
  term: "木漏れ日",
  translation: "sunlight filtering through trees",
  translations: { en: "sunlight filtering through trees", tr: "ağaçların arasından süzülen güneş" },
  translationMeaningsByLocale: { en: ["sunlight filtering through trees"] },
  pronunciation: "komorebi",
  partOfSpeech: "noun",
  example: "木漏れ日がきれいです。",
  exampleTranslation: "The sunlight filtering through the trees is beautiful.",
  examples: [{ sentence: "木漏れ日がきれいです。", translation: "The light is beautiful.", translations: { en: "The light is beautiful." } }],
  grammar: { summary: "", rules: [], details: [] },
  grammarByLocale: {},
} as unknown as VocabularyCard;

afterEach(() => cleanup());

describe("AutomationVocabularyCard", () => {
  it("renders the automation-owned front design and selected native translation", () => {
    render(<AutomationVocabularyCard card={card} face="front" nativeLanguage="en" />);

    const face = screen.getByRole("article", { name: "木漏れ日, A2" });
    expect(face).toHaveAttribute("data-automation-card-face", "front");
    expect(face).toHaveAttribute("data-automation-card-layout", "standard");
    expect(within(face).getByText("木漏れ日")).toBeInTheDocument();
    expect(within(face).getByText("sunlight filtering through trees")).toBeInTheDocument();
    expect(within(face).getByText("komorebi")).toBeInTheDocument();
    expect(within(face).getByText("木漏れ日がきれいです。")).toBeInTheDocument();
    expect(within(face).getByTestId("score-icon")).toBeInTheDocument();
  });

  it("renders only the requested back face", () => {
    render(<AutomationVocabularyCard card={card} face="back" nativeLanguage="en" />);

    const face = screen.getByRole("article", { name: "木漏れ日, A2" });
    expect(face).toHaveAttribute("data-automation-card-face", "back");
    expect(face.querySelector("[data-card-back-tier]")).toHaveAttribute("data-card-back-tier", "A2");
    expect(within(face).getByText("Click to flip")).toBeInTheDocument();
    expect(within(face).queryByText("木漏れ日")).not.toBeInTheDocument();
  });

  it("supports the dedicated daily-challenge layout without study metadata", () => {
    render(<AutomationVocabularyCard card={card} face="front" layout="daily-challenge" nativeLanguage="en" />);

    const face = screen.getByRole("article", { name: "木漏れ日, A2" });
    expect(face).toHaveAttribute("data-automation-card-layout", "daily-challenge");
    expect(within(face).getByText("sunlight filtering through trees")).toBeInTheDocument();
    expect(within(face).queryByText("komorebi")).not.toBeInTheDocument();
    expect(within(face).queryByTestId("score-icon")).not.toBeInTheDocument();
  });
});

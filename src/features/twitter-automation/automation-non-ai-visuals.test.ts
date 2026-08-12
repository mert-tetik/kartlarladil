import { describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { renderAutomationCarousel, renderAutomationSelfImage } from "@/features/twitter-automation/automation-non-ai-visuals";

const cards = VOCABULARY_CARDS.filter((card) => card.language === "en" && card.termKind === "word").slice(0, 6);

describe("automation non-AI visuals", () => {
  it("renders every self image mode to a schedulable PNG", () => {
    const common = { cards, nativeLanguage: "tr" as const };
    const outputs = [
      renderAutomationSelfImage({ ...common, mode: "self-mini-quiz" }),
      renderAutomationSelfImage({ ...common, mode: "self-daily-challenge" }),
      renderAutomationSelfImage({
        ...common,
        mode: "self-false-friends",
        falseFriends: { firstTerm: "angry", secondTerm: "furious", firstTier: "A1", secondTier: "B2", firstExplanation: "Kizgin olmak icin kullanilir.", secondExplanation: "Cok daha siddetli ofkeyi anlatir." },
      }),
      renderAutomationSelfImage({
        ...common,
        mode: "self-vocabulary-progression",
        vocabularyProgression: { beginnerTerm: "help", intermediateTerm: "assist", advancedTerm: "facilitate", beginnerTier: "A1", intermediateTier: "B2", advancedTier: "C1", beginnerExplanation: "Basit destek vermeyi anlatir.", intermediateExplanation: "Daha resmi destek vermeyi anlatir.", advancedExplanation: "Bir seyi kolaylastirmayi anlatir." },
      }),
      renderAutomationSelfImage({
        ...common,
        mode: "self-example-sentences",
        exampleSentences: { sentences: [
          { sentence: "I take the train every morning.", translation: "Her sabah trene binerim." },
          { sentence: "She called her friend after work.", translation: "Isten sonra arkadasini aradi." },
          { sentence: "We are planning a short trip.", translation: "Kisa bir gezi planliyoruz." },
        ] },
      }),
    ];

    expect(cards).toHaveLength(6);
    expect(outputs).toHaveLength(5);
    expect(outputs.every((dataUrl) => dataUrl.startsWith("data:image/png;base64,"))).toBe(true);
  });

  it("renders an intro and each card for both carousel modes", () => {
    const vocabulary = renderAutomationCarousel({ cards, mode: "vocabulary-carousel", language: "en", nativeLanguage: "tr" });
    const tierProgression = renderAutomationCarousel({ cards: cards.slice(0, 5), mode: "tier-progression-carousel", language: "en", nativeLanguage: "tr" });

    expect(vocabulary).toHaveLength(7);
    expect(tierProgression).toHaveLength(6);
    expect([...vocabulary, ...tierProgression].every((dataUrl) => dataUrl.startsWith("data:image/png;base64,"))).toBe(true);
  });
});

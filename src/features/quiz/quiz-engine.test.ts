import { vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { TIER_REQUIREMENTS } from "@/data/tiers";
import { getPrimaryCardTranslation, getStudyLocale } from "@/features/cards/card-localization";
import { getCardDefinitionKey } from "@/data/card-definitions";
import type { CardDefinitionMap } from "@/data/card-definitions";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import {
  addCardToInventory,
  applyAnswerProgress,
  buildDefinitionQuizQuestion,
  buildQuizQuestion,
  buildListeningQuizQuestion,
  buildSentenceCompletionQuizQuestion,
  buildTrueFalseQuizQuestion,
  createInventoryCard,
  getTierRequirement,
  isAnswerSimilarEnough,
  shouldUseSentenceCompletionQuestion,
  shouldUseDefinitionQuestion,
  shouldUseListeningQuestion,
  shouldUseTrueFalseQuestion,
} from "@/features/quiz/quiz-engine";
import type { InventoryCard, VocabularyCard } from "@/types/domain";

describe("quiz engine", () => {
  it("exposes the planned tier requirements", () => {
    expect(getTierRequirement("A1")).toBe(4);
    expect(getTierRequirement("A2")).toBe(4);
    expect(getTierRequirement("B1")).toBe(6);
    expect(getTierRequirement("B2")).toBe(6);
    expect(getTierRequirement("C1")).toBe(8);
    expect(TIER_REQUIREMENTS).toEqual({ A1: 4, A2: 4, B1: 6, B2: 6, C1: 8 });
  });

  it("increments correct answers and marks a card learned at its tier threshold", () => {
    const card = VOCABULARY_CARDS.find((item) => item.tier === "A1");
    expect(card).toBeDefined();

    let state = createInventoryCard(card!.id);
    for (let step = 1; step <= 4; step += 1) {
      state = applyAnswerProgress(
        state,
        card!,
        true,
        `2026-01-0${step}T00:00:00.000Z`,
      );
    }

    expect(state.correctCount).toBe(4);
    expect(state.status).toBe("learned");
    expect(state.learnedAt).toBe("2026-01-04T00:00:00.000Z");
  });

  it("decrements wrong answers without going below zero", () => {
    const card = VOCABULARY_CARDS[0];
    const activeCard: InventoryCard = {
      ...createInventoryCard(card.id),
      correctCount: 1,
    };

    const firstWrong = applyAnswerProgress(activeCard, card, false);
    const secondWrong = applyAnswerProgress(firstWrong, card, false);

    expect(firstWrong.correctCount).toBe(0);
    expect(secondWrong.correctCount).toBe(0);
    expect(secondWrong.status).toBe("active");
  });

  it("can mark a card as learned in a single correct answer when forced", () => {
    const card = VOCABULARY_CARDS.find((item) => item.tier === "A1");
    expect(card).toBeDefined();

    const state = createInventoryCard(card!.id);
    const forced = applyAnswerProgress(
      state,
      card!,
      true,
      "2026-01-01T00:00:00.000Z",
      true,
    );

    expect(forced.correctCount).toBe(1);
    expect(forced.status).toBe("learned");
    expect(forced.learnedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("does not mark a forced card learned when the answer is incorrect", () => {
    const card = VOCABULARY_CARDS.find((item) => item.tier === "A1");
    expect(card).toBeDefined();

    const state = createInventoryCard(card!.id);
    const forcedWrong = applyAnswerProgress(
      state,
      card!,
      false,
      "2026-01-01T00:00:00.000Z",
      true,
    );

    expect(forcedWrong.correctCount).toBe(0);
    expect(forcedWrong.status).toBe("active");
    expect(forcedWrong.learnedAt).toBeUndefined();
  });

  it("does not add the same card twice", () => {
    const card = VOCABULARY_CARDS[0];
    const first = addCardToInventory([], card.id);
    const second = addCardToInventory(first, card.id);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  it("keeps inventory cards separated by language", () => {
    const enCard = VOCABULARY_CARDS.find((card) => card.language === "en")!;
    const deCard = VOCABULARY_CARDS.find((card) => card.language === "de")!;
    const inventory = [createInventoryCard(enCard.id), createInventoryCard(deCard.id)];

    expect(filterInventoryCards({ cards: inventory, language: "en" })).toHaveLength(1);
    expect(filterInventoryCards({ cards: inventory, language: "de" })).toHaveLength(1);
    expect(filterInventoryCards({ cards: inventory, language: "ru" })).toHaveLength(0);
  });

  it("builds a four-option multiple choice question", () => {
    const question = buildQuizQuestion(VOCABULARY_CARDS[0], VOCABULARY_CARDS);

    expect(question.options).toHaveLength(4);
    expect(question.options).toContain(question.correctAnswer);
  });

  it("builds a four-option listening question from the target language", () => {
    const card = VOCABULARY_CARDS.find((item) => item.language === "en")!;
    const question = buildListeningQuizQuestion(card, VOCABULARY_CARDS);

    expect(question).not.toBeNull();
    expect(question?.options).toHaveLength(4);
    expect(question?.correctAnswer).toBe(card.term);
    expect(question?.options).toContain(card.term);
    expect(question?.options.every((option) =>
      VOCABULARY_CARDS.some(
        (candidate) => candidate.language === card.language && candidate.term === option,
      ),
    )).toBe(true);
  });

  it("uses a one-in-five probability for listening questions", () => {
    const randomSpy = vi.spyOn(Math, "random");

    randomSpy.mockReturnValue(0.19);
    expect(shouldUseListeningQuestion()).toBe(true);

    randomSpy.mockReturnValue(0.2);
    expect(shouldUseListeningQuestion()).toBe(false);

    randomSpy.mockRestore();
  });

  it("builds a definition question with one answer and three unique imposters", () => {
    const cards = VOCABULARY_CARDS
      .filter((item) => item.language === "en" && item.tier === "A1")
      .slice(0, 4);
    const [card, ...imposterCards] = cards;
    expect(card).toBeDefined();
    expect(imposterCards).toHaveLength(3);

    const definitions = Object.fromEntries([
      [card, "Bir şeyi geri vermek üzere geçici olarak almak."],
      ...imposterCards.map((candidate, index) => [candidate, `Test definition ${index + 1}.`]),
    ].map(([candidate, definition]) => [
      getCardDefinitionKey(candidate as VocabularyCard),
      { tr: definition },
    ]));
    const randomSpy = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0.34)
      .mockReturnValueOnce(0.67)
      .mockReturnValue(0.75);

    const question = buildDefinitionQuizQuestion(card!, cards, "tr", definitions as CardDefinitionMap);

    expect(question).not.toBeNull();
    expect(question?.correctAnswer).toBe(question?.definition);
    expect(question?.options).toHaveLength(4);
    expect(new Set(question?.options).size).toBe(4);
    expect(question?.options).toContain(question?.definition);

    randomSpy.mockRestore();
  });

  it("uses the definition stored on a custom card", () => {
    const baseCard = VOCABULARY_CARDS.find((item) => item.language === "en" && item.tier === "A1");
    const candidateCards = VOCABULARY_CARDS
      .filter((item) => item.language === "en" && item.tier === "A1")
      .slice(0, 4);
    expect(baseCard).toBeDefined();
    expect(candidateCards).toHaveLength(4);

    const customCard = {
      ...baseCard!,
      id: "custom:user-1:definition-card",
      sourceKey: "custom:user-1:definition-card",
      englishKey: "custom-definition-card",
      term: "custom definition card",
      definitionsByLocale: { tr: "Öğrenci tarafından oluşturulmuş özel bir kart." },
    };
    const definitions = Object.fromEntries(
      candidateCards.map((candidate, index) => [
        getCardDefinitionKey(candidate),
        { tr: `Catalog definition ${index + 1}.` },
      ]),
    ) as CardDefinitionMap;
    const randomSpy = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.25)
      .mockReturnValueOnce(0.5)
      .mockReturnValue(0);

    const question = buildDefinitionQuizQuestion(customCard, candidateCards, "tr", definitions);

    expect(question?.definition).toBe("Öğrenci tarafından oluşturulmuş özel bir kart.");
    expect(question?.options).toContain(question?.definition);
    expect(new Set(question?.options).size).toBe(4);

    randomSpy.mockRestore();
  });

  it("does not build a definition question when the card definition is missing", () => {
    const card = VOCABULARY_CARDS.find((item) => item.language === "en" && item.tier === "A1");
    expect(card).toBeDefined();

    const question = buildDefinitionQuizQuestion(card!, VOCABULARY_CARDS, "tr", {});

    expect(question).toBeNull();
  });

  it("stops definition imposter selection after twenty unsuccessful attempts", () => {
    const cards = VOCABULARY_CARDS
      .filter((item) => item.language === "en" && item.tier === "A1")
      .slice(0, 2);
    const [card, imposter] = cards;
    const definitions = {
      [getCardDefinitionKey(card!)]: { tr: "Gerçek tanım." },
      [getCardDefinitionKey(imposter!)]: { tr: "Tek imposter tanım." },
    };
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    const question = buildDefinitionQuizQuestion(card!, cards, "tr", definitions);

    expect(question).toBeNull();
    expect(randomSpy).toHaveBeenCalledTimes(20);
    randomSpy.mockRestore();
  });

  it("uses definition questions exactly below the fifty percent cutoff", () => {
    const randomSpy = vi.spyOn(Math, "random");

    randomSpy.mockReturnValue(0.49);
    expect(shouldUseDefinitionQuestion()).toBe(true);

    randomSpy.mockReturnValue(0.5);
    expect(shouldUseDefinitionQuestion()).toBe(false);

    randomSpy.mockRestore();
  });

  it("uses only the primary meaning for multiple choice answers", () => {
    const card = VOCABULARY_CARDS.find(
      (item) => item.language !== "tr" && item.translationMeaningsByLocale.tr.length > 1,
    );
    expect(card).toBeDefined();

    const question = buildQuizQuestion(card!, VOCABULARY_CARDS, "tr");

    expect(question.correctAnswer).toBe(card!.translationMeaningsByLocale.tr[0]);
    expect(question.correctAnswer).not.toContain(",");
  });

  it("keeps distractors in the requested answer language", () => {
    const card = VOCABULARY_CARDS.find((item) => item.language === "en" && item.translationMeaningsByLocale.tr.length > 0);
    expect(card).toBeDefined();

    const question = buildQuizQuestion(card!, VOCABULARY_CARDS, "tr");
    const eligibleAnswers = new Set(
      VOCABULARY_CARDS
        .filter((candidate) => candidate.id !== card!.id && getStudyLocale(candidate.language, "tr") === "tr")
        .map((candidate) => getPrimaryCardTranslation(candidate, "tr")),
    );

    for (const option of question.options) {
      if (option === question.correctAnswer) {
        continue;
      }

      expect(eligibleAnswers.has(option)).toBe(true);
    }
  });

  it("builds a true-false question with the actual meaning attached", () => {
    const card = VOCABULARY_CARDS.find((item) => item.language === "en" && item.translationMeaningsByLocale.tr.length > 0);
    expect(card).toBeDefined();

    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValue(0.75);

    const question = buildTrueFalseQuizQuestion(card!, VOCABULARY_CARDS, "tr");

    expect(question.actualMeaning).toBe(getPrimaryCardTranslation(card!, "tr"));
    expect(question.proposedMeaning).toBe(question.actualMeaning);
    expect(question.isTrue).toBe(true);
    expect(question.correctAnswer).toBe("true");

    randomSpy.mockRestore();
  });

  it("can build a false true-false question with a decoy meaning", () => {
    const card = VOCABULARY_CARDS.find((item) => item.language === "en" && item.translationMeaningsByLocale.tr.length > 0);
    expect(card).toBeDefined();

    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(0.1).mockReturnValueOnce(0);

    const question = buildTrueFalseQuizQuestion(card!, VOCABULARY_CARDS, "tr");

    expect(question.isTrue).toBe(false);
    expect(question.correctAnswer).toBe("false");
    expect(question.proposedMeaning).not.toBe(question.actualMeaning);

    randomSpy.mockRestore();
  });

  it("builds a six-option sentence completion question from the card example", () => {
    const card = VOCABULARY_CARDS.find((item) =>
      item.examples.some((example) =>
        example.sentence.toLocaleLowerCase().includes(item.term.toLocaleLowerCase()),
      ),
    );
    expect(card).toBeDefined();

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const question = buildSentenceCompletionQuizQuestion(card!, VOCABULARY_CARDS);

    expect(question).not.toBeNull();
    expect(question?.sentenceWithBlank).toContain("_____");
    expect(question?.options).toHaveLength(6);
    expect(question?.options).toContain(card!.term);
    expect(question?.correctAnswer).toBe(card!.term);

    randomSpy.mockRestore();
  });

  it("randomly selects between the card's usable example sentences", () => {
    const baseCard = VOCABULARY_CARDS.find((item) => item.language === "en" && item.termKind === "word");
    expect(baseCard).toBeDefined();

    const card = {
      ...baseCard!,
      examples: [
        { ...baseCard!.examples[0], sentence: `${baseCard!.term} appears in the first example.` },
        { ...baseCard!.examples[1], sentence: `I used ${baseCard!.term} in the second example.` },
      ],
    };
    const randomSpy = vi.spyOn(Math, "random");

    randomSpy.mockReturnValue(0);
    const firstQuestion = buildSentenceCompletionQuizQuestion(card, VOCABULARY_CARDS);

    randomSpy.mockReturnValue(0.999999);
    const secondQuestion = buildSentenceCompletionQuizQuestion(card, VOCABULARY_CARDS);

    expect(firstQuestion?.sentenceWithBlank).toBe("_____ appears in the first example.");
    expect(secondQuestion?.sentenceWithBlank).toBe("I used _____ in the second example.");
    expect(firstQuestion?.sentenceWithBlank).not.toBe(secondQuestion?.sentenceWithBlank);

    randomSpy.mockRestore();
  });

  it("uses the true-false question type only for zero-progress active cards and only below the 50% cutoff", () => {
    const activeCard = createInventoryCard(VOCABULARY_CARDS[0].id);
    const randomSpy = vi.spyOn(Math, "random");

    randomSpy.mockReturnValue(0.49);
    expect(shouldUseTrueFalseQuestion(activeCard, "active")).toBe(true);

    randomSpy.mockReturnValue(0.5);
    expect(shouldUseTrueFalseQuestion(activeCard, "active")).toBe(false);
    expect(shouldUseTrueFalseQuestion({ ...activeCard, correctCount: 1 }, "active")).toBe(false);
    expect(shouldUseTrueFalseQuestion(activeCard, "learned")).toBe(false);

    randomSpy.mockRestore();
  });

  it("uses sentence completion one third of the time except for card-learning questions", () => {
    const randomSpy = vi.spyOn(Math, "random");

    randomSpy.mockReturnValue(0);
    expect(shouldUseSentenceCompletionQuestion(true)).toBe(false);

    randomSpy.mockReturnValue(0.32);
    expect(shouldUseSentenceCompletionQuestion(false)).toBe(true);

    randomSpy.mockReturnValue(0.34);
    expect(shouldUseSentenceCompletionQuestion(false)).toBe(false);

    randomSpy.mockRestore();
  });

  describe("isAnswerSimilarEnough", () => {
    it("accepts an answer that is only missing the last three letters", () => {
      expect(isAnswerSimilarEnough("dance", "dancing")).toBe(true);
      expect(isAnswerSimilarEnough("danc", "dancing")).toBe(true);
    });

    it("accepts an answer that adds up to three extra trailing letters", () => {
      expect(isAnswerSimilarEnough("dancing", "dance")).toBe(true);
    });

    it("accepts an answer when only the last three letters differ", () => {
      expect(isAnswerSimilarEnough("dancery", "dancing")).toBe(true);
      expect(isAnswerSimilarEnough("dancer", "dancing")).toBe(true);
    });

    it("rejects an answer when more than the last three letters are missing", () => {
      expect(isAnswerSimilarEnough("dan", "dancing")).toBe(false);
    });

    it("rejects an answer when the mismatch is not in the last three letters", () => {
      expect(isAnswerSimilarEnough("dane", "dancing")).toBe(false);
    });

    it("rejects an answer that is too different even when the first three letters match", () => {
      expect(isAnswerSimilarEnough("dankingly", "dancing")).toBe(false);
      expect(isAnswerSimilarEnough("danceable", "dancing")).toBe(false);
    });

    it("still accepts small typos within the similarity threshold", () => {
      expect(isAnswerSimilarEnough("dancig", "dancing")).toBe(true);
    });
  });
});

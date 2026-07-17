import { beforeEach, describe, expect, it, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { getTierRequirement } from "@/features/quiz/quiz-engine";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import { localCardRepository } from "@/features/cards/card-repository";
import { InventoryActionError, useInventoryStore } from "@/features/inventory/inventory-store";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";
import { addCloudInventoryCardAction, createCustomCardAction } from "@/features/inventory/cloud-actions";
import type { VocabularyCard } from "@/types/domain";

vi.mock("@/lib/twa-analytics", () => ({
  sendTwaAnalyticsEvent: vi.fn(),
}));

vi.mock("@/features/missions/mission-sync", () => ({
  syncMissionsFromClientState: vi.fn(async () => {}),
}));

vi.mock("@/features/inventory/cloud-actions", () => ({
  addCloudInventoryCardAction: vi.fn(),
  createCustomCardAction: vi.fn(),
  listCloudInventoryAction: vi.fn(),
  loadCustomCardsAction: vi.fn(),
  migrateLocalInventoryToCloudAction: vi.fn(),
  recordCloudPracticeAttemptAction: vi.fn(),
  removeCloudInventoryCardAction: vi.fn(),
  resetCloudInventoryAction: vi.fn(),
}));

const testCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.tier === "A1")!;

describe("inventory store analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    customCardRegistry.clear();
    useInventoryStore.setState({
      cards: [],
      attempts: [],
      ownerUserId: null,
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
      activeCardLimit: null,
      pendingCardIds: new Set(),
    });
  });

  it("sends a card added event for local inventory adds", async () => {
    const result = await useInventoryStore.getState().addCard(testCard.id);

    expect(result.ok).toBe(true);
    expect(sendTwaAnalyticsEvent).toHaveBeenCalledWith("fd_card_added", {
      params: {
        card_id: testCard.id,
        card_language: testCard.language,
        card_tier: testCard.tier,
        term_kind: testCard.termKind,
      },
    });
  });

  it("keeps later optimistic cloud additions while earlier queued additions resolve", async () => {
    const secondCard = VOCABULARY_CARDS.find(
      (card) => card.language === "en" && card.tier === "A2",
    )!;
    let resolveFirstAdd!: (value: Awaited<ReturnType<typeof addCloudInventoryCardAction>>) => void;
    let resolveSecondAdd!: (value: Awaited<ReturnType<typeof addCloudInventoryCardAction>>) => void;

    vi.mocked(addCloudInventoryCardAction)
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirstAdd = resolve;
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecondAdd = resolve;
      }));
    useInventoryStore.setState({ cloudEnabled: true, ownerUserId: "user-1" });

    const firstAdd = useInventoryStore.getState().addCard(testCard.id);
    const secondAdd = useInventoryStore.getState().addCard(secondCard.id);

    expect(useInventoryStore.getState().cards.map((card) => card.cardId)).toEqual([testCard.id, secondCard.id]);

    await waitForQueuedCloudAdd();
    resolveFirstAdd({
      status: "success",
      message: "",
      data: {
        cards: [{ cardId: testCard.id, status: "active", correctCount: 0, addedAt: "2026-07-17T00:00:00.000Z" }],
        attempts: [],
      },
    });
    await firstAdd;

    expect(useInventoryStore.getState().cards.map((card) => card.cardId)).toEqual([secondCard.id, testCard.id]);

    await waitForQueuedCloudAdd();
    resolveSecondAdd({
      status: "success",
      message: "",
      data: {
        cards: [
          { cardId: testCard.id, status: "active", correctCount: 0, addedAt: "2026-07-17T00:00:00.000Z" },
          { cardId: secondCard.id, status: "active", correctCount: 0, addedAt: "2026-07-17T00:00:01.000Z" },
        ],
        attempts: [],
      },
    });
    await secondAdd;

    expect(useInventoryStore.getState().cards.map((card) => card.cardId)).toEqual([testCard.id, secondCard.id]);
  });

  it("sends a card learned event on the first learned transition", async () => {
    useInventoryStore.setState({
      cards: [
        {
          cardId: testCard.id,
          status: "active",
          correctCount: getTierRequirement(testCard.tier) - 1,
          addedAt: "2026-07-09T00:00:00.000Z",
        },
      ],
    });

    const result = await useInventoryStore.getState().recordAnswer({
      cardId: testCard.id,
      selectedAnswer: "elma",
      correctAnswer: "elma",
      isCorrect: true,
      mode: "active",
    });

    expect(result?.inventoryCard.status).toBe("learned");
    expect(sendTwaAnalyticsEvent).toHaveBeenCalledWith("fd_card_learned", {
      params: {
        card_id: testCard.id,
        card_language: testCard.language,
        card_tier: testCard.tier,
        term_kind: testCard.termKind,
        correct_count: getTierRequirement(testCard.tier),
      },
    });
  });

  it("sends a custom card added event after creation", async () => {
    const customCard: VocabularyCard = {
      id: "custom-card-1",
      sourceKey: "custom-card-1",
      englishKey: "foxling",
      language: "en" as const,
      tier: "A1" as const,
      term: "foxling",
      termKind: "word" as const,
      translation: "tilki yavrusu",
      partOfSpeech: "noun",
      pronunciation: "/foks-ling/",
      translations: {
        tr: "tilki yavrusu",
        en: "foxling",
        de: "Fuchsjunges",
        ru: "лисёнок",
        fr: "renardeau",
        es: "cachorro de zorro",
        it: "cucciolo di volpe",
        pt: "filhote de raposa",
        nl: "vossenwelp",
        pl: "lisiątko",
        ar: "شبل الثعلب",
        ja: "子ギツネ",
        ko: "여우 새끼",
        "zh-CN": "小狐狸",
      },
      translationMeaningsByLocale: {
        tr: ["tilki yavrusu"],
        en: ["foxling"],
        de: ["Fuchsjunges"],
        ru: ["лисёнок"],
        fr: ["renardeau"],
        es: ["cachorro de zorro"],
        it: ["cucciolo di volpe"],
        pt: ["filhote de raposa"],
        nl: ["vossenwelp"],
        pl: ["lisiątko"],
        ar: ["شبل الثعلب"],
        ja: ["子ギツネ"],
        ko: ["여우 새끼"],
        "zh-CN": ["小狐狸"],
      },
      example: "The foxling ran fast.",
      exampleTranslation: "Tilki yavrusu hizli kosu.",
      examples: [
        {
          id: "example-1",
          context: "natural",
          label: "Example 1",
          sentence: "The foxling ran fast.",
          translation: "Tilki yavrusu hizli kosu.",
          translations: {
            tr: "Tilki yavrusu hizli kosu.",
            en: "The foxling ran fast.",
            de: "Das Fuchsjunge rannte schnell.",
            ru: "Лисёнок быстро бежал.",
            fr: "Le renardeau a couru vite.",
            es: "El cachorro de zorro corrio rapido.",
            it: "Il cucciolo di volpe corse veloce.",
            pt: "O filhote de raposa correu rapido.",
            nl: "Het vossenwelp rende snel.",
            pl: "Lisiatko bieglo szybko.",
            ar: "ركض شبل الثعلب بسرعة.",
            ja: "子ギツネは速く走った。",
            ko: "여우 새끼가 빨리 달렸다.",
            "zh-CN": "小狐狸跑得很快。",
          },
        },
      ],
      grammar: {
        summary: "countable noun",
        rules: ["Use it as a regular singular noun."],
        details: ["Mostly used in playful or descriptive contexts."],
      },
      grammarByLocale: {
        tr: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        en: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        de: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        ru: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        fr: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        es: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        it: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        pt: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        nl: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        pl: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        ar: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        ja: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        ko: { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
        "zh-CN": { summary: "countable noun", rules: ["Use it as a regular singular noun."], details: ["Mostly used in playful or descriptive contexts."] },
      },
    };

    vi.mocked(createCustomCardAction).mockResolvedValue({
      status: "success",
      message: "",
      data: {
        card: {
          cardId: customCard.id,
          status: "active",
          correctCount: 0,
          addedAt: "2026-07-09T00:00:00.000Z",
        },
        vocabularyCard: customCard,
      },
    });

    await useInventoryStore.getState().createCustomCard({
      language: "en",
      tier: "A1",
      termKind: "word",
      draft: {
        term: "foxling",
        partOfSpeech: "noun",
        pronunciation: "/foks-ling/",
        translations: {
          tr: "tilki yavrusu",
          en: "foxling",
          de: "Fuchsjunges",
          ru: "лисёнок",
          fr: "renardeau",
          es: "cachorro de zorro",
          it: "cucciolo di volpe",
          pt: "filhote de raposa",
          nl: "vossenwelp",
          pl: "lisiątko",
          ar: "شبل الثعلب",
          ja: "子ギツネ",
          ko: "여우 새끼",
          "zh-CN": "小狐狸",
        },
        example: "The foxling ran fast.",
        exampleTranslation: "Tilki yavrusu hizli kosu.",
        grammar: ["countable noun"],
        termKind: "word",
      },
    });

    expect(sendTwaAnalyticsEvent).toHaveBeenCalledWith("fd_custom_card_added", {
      params: {
        card_id: customCard.id,
        card_language: customCard.language,
        card_tier: customCard.tier,
        term_kind: customCard.termKind,
      },
    });
  });

  it("shows an optimistic custom card before its background creation completes", async () => {
    const optimisticCard: VocabularyCard = {
      ...testCard,
      id: "pending-custom-card-1",
      sourceKey: "pending-custom-card-1",
    };
    const savedCard: VocabularyCard = {
      ...testCard,
      id: "custom-card-2",
      sourceKey: "custom-card-2",
    };
    let resolveCreation!: (value: Awaited<ReturnType<typeof createCustomCardAction>>) => void;

    vi.mocked(createCustomCardAction).mockImplementation(
      () => new Promise((resolve) => {
        resolveCreation = resolve;
      }),
    );

    const creation = useInventoryStore.getState().createCustomCard({
      language: optimisticCard.language,
      tier: optimisticCard.tier,
      termKind: optimisticCard.termKind,
      draft: {
        term: optimisticCard.term,
        partOfSpeech: optimisticCard.partOfSpeech,
        pronunciation: optimisticCard.pronunciation,
        translations: optimisticCard.translations,
        example: optimisticCard.example,
        exampleTranslation: optimisticCard.exampleTranslation,
        grammar: optimisticCard.grammar.rules,
        termKind: optimisticCard.termKind,
      },
      optimisticCard,
    });

    expect(useInventoryStore.getState().cards).toEqual([
      expect.objectContaining({ cardId: optimisticCard.sourceKey, status: "active" }),
    ]);
    expect(localCardRepository.findById(optimisticCard.sourceKey)).toEqual(optimisticCard);

    resolveCreation({
      status: "success",
      message: "",
      data: {
        card: {
          cardId: savedCard.sourceKey,
          status: "active",
          correctCount: 0,
          addedAt: "2026-07-17T00:00:00.000Z",
        },
        vocabularyCard: savedCard,
      },
    });
    await creation;

    expect(useInventoryStore.getState().cards).toEqual([
      expect.objectContaining({ cardId: savedCard.sourceKey, status: "active" }),
    ]);
    expect(localCardRepository.findById(optimisticCard.sourceKey)).toBeUndefined();
    expect(localCardRepository.findById(savedCard.sourceKey)).toEqual(savedCard);
  });

  it("exposes the active card limit when an optimistic custom card is rejected", async () => {
    const optimisticCard: VocabularyCard = {
      ...testCard,
      id: "pending-limit-card",
      sourceKey: "pending-limit-card",
    };
    vi.mocked(createCustomCardAction).mockResolvedValue({
      status: "error",
      message: "Active card limit reached",
      errorCode: "free_active_card_limit",
    });

    const creation = useInventoryStore.getState().createCustomCard({
      language: optimisticCard.language,
      tier: optimisticCard.tier,
      termKind: optimisticCard.termKind,
      draft: {
        term: optimisticCard.term,
        partOfSpeech: optimisticCard.partOfSpeech,
        pronunciation: optimisticCard.pronunciation,
        translations: optimisticCard.translations,
        example: optimisticCard.example,
        exampleTranslation: optimisticCard.exampleTranslation,
        grammar: optimisticCard.grammar.rules,
        termKind: optimisticCard.termKind,
      },
      optimisticCard,
    });

    await expect(creation).rejects.toEqual(expect.any(InventoryActionError));
    await expect(creation).rejects.toMatchObject({ errorCode: "free_active_card_limit" });
    expect(useInventoryStore.getState().cards).toEqual([]);
  });
});

function waitForQueuedCloudAdd() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

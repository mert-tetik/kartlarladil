import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { LOCALE_CODES } from "@/data/languages";
import { getTierRequirement } from "@/features/quiz/quiz-engine";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import { localCardRepository } from "@/features/cards/card-repository";
import { InventoryActionError, useInventoryStore } from "@/features/inventory/inventory-store";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";
import {
  addCloudInventoryCardAction,
  addCloudInventoryCardsAction,
  createCustomCardAction,
  removeCloudInventoryCardAction,
} from "@/features/inventory/cloud-actions";
import type { VocabularyCard } from "@/types/domain";

vi.mock("@/lib/twa-analytics", () => ({
  sendTwaAnalyticsEvent: vi.fn(),
}));

vi.mock("@/features/missions/mission-sync", () => ({
  syncMissionsFromClientState: vi.fn(async () => {}),
}));

vi.mock("@/features/inventory/cloud-actions", () => ({
  addCloudInventoryCardAction: vi.fn(),
  addCloudInventoryCardsAction: vi.fn(),
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
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

  it("rolls back an optimistic single-card add when the server action rejects", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(addCloudInventoryCardAction).mockRejectedValueOnce(new Error("temporary transport failure"));
    useInventoryStore.setState({ cloudEnabled: true, ownerUserId: "user-1" });

    const result = await useInventoryStore.getState().addCard(testCard.id);
    const state = useInventoryStore.getState();

    expect(result).toEqual({ ok: false, firstCardAdded: false });
    expect(state.cards).toEqual([]);
    expect(state.pendingCardIds.size).toBe(0);
    expect(state.cloudLoading).toBe(false);
    expect(state.cloudError).toBe("The card action could not be completed right now. Please try again.");
    expect(logger).toHaveBeenCalledWith(
      "[FoxiesDeck inventory] Cloud action rejected unexpectedly.",
      expect.objectContaining({ operation: "add card" }),
    );
  });

  it("clears every optimistic batch-add marker when the server action rejects", async () => {
    const secondCard = VOCABULARY_CARDS.find(
      (card) => card.language === "en" && card.tier === "A2",
    )!;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(addCloudInventoryCardsAction).mockRejectedValueOnce(new Error("temporary transport failure"));
    useInventoryStore.setState({ cloudEnabled: true, ownerUserId: "user-1" });

    const result = await useInventoryStore.getState().addCards([testCard.id, secondCard.id]);
    const state = useInventoryStore.getState();

    expect(result).toMatchObject({
      ok: false,
      addedCardIds: [],
      remainingCardIds: [testCard.id, secondCard.id],
    });
    expect(state.cards).toEqual([]);
    expect(state.pendingCardIds.size).toBe(0);
    expect(state.cloudLoading).toBe(false);
    expect(state.cloudError).toBe("The card action could not be completed right now. Please try again.");
  });

  it("restores the previous card and attempts when a cloud removal action rejects", async () => {
    const originalCard = { cardId: testCard.id, status: "active" as const, correctCount: 2, addedAt: "2026-01-01" };
    const originalAttempt = {
      id: "attempt-1",
      cardId: testCard.id,
      selectedAnswer: "a",
      correctAnswer: "b",
      isCorrect: false,
      mode: "active" as const,
      createdAt: "2026-01-02",
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(removeCloudInventoryCardAction).mockRejectedValueOnce(new Error("temporary transport failure"));
    useInventoryStore.setState({
      cloudEnabled: true,
      ownerUserId: "user-1",
      cards: [originalCard],
      attempts: [originalAttempt],
    });

    await useInventoryStore.getState().removeCard(testCard.id);
    const state = useInventoryStore.getState();

    expect(state.cards).toEqual([originalCard]);
    expect(state.attempts).toEqual([originalAttempt]);
    expect(state.pendingCardIds.size).toBe(0);
    expect(state.cloudLoading).toBe(false);
    expect(state.cloudError).toBe("The card action could not be completed right now. Please try again.");
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

  it("shows a batch cloud addition locally before the background sync completes", async () => {
    let resolveBatchAdd!: (value: Awaited<ReturnType<typeof addCloudInventoryCardsAction>>) => void;
    vi.mocked(addCloudInventoryCardsAction).mockImplementation(
      () => new Promise((resolve) => {
        resolveBatchAdd = resolve;
      }),
    );
    useInventoryStore.setState({ cloudEnabled: true, ownerUserId: "user-1" });

    const addition = useInventoryStore.getState().addCards([testCard.id]);

    expect(useInventoryStore.getState().cards).toEqual([
      expect.objectContaining({ cardId: testCard.id, status: "active", correctCount: 0 }),
    ]);
    expect(useInventoryStore.getState().pendingCardIds.has(testCard.id)).toBe(true);

    await waitForQueuedCloudAdd();
    resolveBatchAdd({
      status: "success",
      message: "",
      data: {
        cards: [{ cardId: testCard.id, status: "active", correctCount: 0, addedAt: "2026-07-17T00:00:00.000Z" }],
        attempts: [],
        addedCardIds: [testCard.id],
        remainingCardIds: [],
      },
    });
    await addition;

    expect(useInventoryStore.getState().pendingCardIds.has(testCard.id)).toBe(false);
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
        pronunciation: "foksling",
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
        examples: [
          { example: "The foxling ran fast.", translation: "Tilki yavrusu hızlı koştu." },
          { example: "A foxling hid among the trees.", translation: "Bir tilki yavrusu ağaçların arasında saklandı." },
        ],
        definitions: Object.fromEntries(LOCALE_CODES.map((locale) => [locale, "A young fox."])),
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
        examples: optimisticCard.examples.map((example) => ({
          example: example.sentence,
          translation: example.translation,
        })),
        definitions: Object.fromEntries(LOCALE_CODES.map((locale) => [
          locale,
          optimisticCard.definitionsByLocale?.[locale] ?? "A test definition.",
        ])),
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
        examples: optimisticCard.examples.map((example) => ({
          example: example.sentence,
          translation: example.translation,
        })),
        definitions: Object.fromEntries(LOCALE_CODES.map((locale) => [
          locale,
          optimisticCard.definitionsByLocale?.[locale] ?? "A test definition.",
        ])),
        grammar: optimisticCard.grammar.rules,
        termKind: optimisticCard.termKind,
      },
      optimisticCard,
    });

    await expect(creation).rejects.toEqual(expect.any(InventoryActionError));
    await expect(creation).rejects.toMatchObject({ errorCode: "free_active_card_limit" });
    expect(useInventoryStore.getState().cards).toEqual([]);
  });

  it("registers an offline custom card in the local deck immediately", () => {
    const optimisticCard: VocabularyCard = {
      ...testCard,
      id: "offline-pending:guest:draft-12345678",
      sourceKey: "offline-pending:guest:draft-12345678",
    };

    useInventoryStore.getState().registerPendingCustomCard(optimisticCard);

    expect(useInventoryStore.getState().cards).toEqual([
      expect.objectContaining({ cardId: optimisticCard.sourceKey, status: "active" }),
    ]);
    expect(localCardRepository.findById(optimisticCard.sourceKey)).toEqual(optimisticCard);
  });

  it("keeps an optimistic offline card and clears loading after a network failure", async () => {
    const optimisticCard: VocabularyCard = {
      ...testCard,
      id: "offline-pending:guest:draft-87654321",
      sourceKey: "offline-pending:guest:draft-87654321",
    };
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const creation = useInventoryStore.getState().createCustomCard({
      language: testCard.language,
      tier: testCard.tier,
      termKind: testCard.termKind,
      idempotencyKey: "draft-87654321",
      optimisticCard,
      draft: {
        term: testCard.term,
        partOfSpeech: testCard.partOfSpeech,
        pronunciation: testCard.pronunciation,
        translations: testCard.translations,
        examples: testCard.examples.map((example) => ({
          example: example.sentence,
          translation: example.translation,
        })),
        definitions: Object.fromEntries(LOCALE_CODES.map((locale) => [
          locale,
          testCard.definitionsByLocale?.[locale] ?? "A test definition.",
        ])),
        grammar: testCard.grammar.rules,
        termKind: testCard.termKind,
      },
    });

    expect(useInventoryStore.getState().cards).toEqual([
      expect.objectContaining({ cardId: optimisticCard.sourceKey, status: "active" }),
    ]);
    await expect(creation).rejects.toThrow("Failed to fetch");

    expect(useInventoryStore.getState().cards).toEqual([
      expect.objectContaining({ cardId: optimisticCard.sourceKey, status: "active" }),
    ]);
    expect(useInventoryStore.getState().pendingCardIds.has(optimisticCard.sourceKey)).toBe(false);
    expect(useInventoryStore.getState().cloudLoading).toBe(false);
    expect(localCardRepository.findById(optimisticCard.sourceKey)).toEqual(optimisticCard);
  });
});

function waitForQueuedCloudAdd() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

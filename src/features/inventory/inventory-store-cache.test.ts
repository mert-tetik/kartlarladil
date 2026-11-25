import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import {
  sanitizePersistedCustomCards,
  useInventoryStore,
} from "@/features/inventory/inventory-store";
import { useLocalCardStudyStore } from "@/features/inventory/local-card-study";
import {
  listCloudInventoryAction,
  loadCustomCardsAction,
  recordCloudPracticeAttemptAction,
} from "@/features/inventory/cloud-actions";
import { STORAGE_KEY } from "@/lib/constants";
import type { InventoryCard, PracticeAttempt } from "@/types/domain";

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

vi.mock("@/features/missions/mission-sync", () => ({
  syncMissionsFromClientState: vi.fn(async () => {}),
}));

describe("sanitizePersistedCustomCards", () => {
  beforeEach(() => {
    window.localStorage.clear();
    customCardRegistry.clear();
    useInventoryStore.setState({
      cards: [],
      attempts: [],
      ownerUserId: null,
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudLoadComplete: true,
      cloudError: "",
      pendingCardIds: new Set(),
      pendingCardMutations: new Map(),
    });
    window.localStorage.clear();
    useLocalCardStudyStore.setState({ cards: {}, learnedReviewIntroSeen: false });
  });

  afterEach(() => customCardRegistry.clear());

  it("keeps complete card definitions and rejects partial cached records", () => {
    const card = VOCABULARY_CARDS.find((candidate) => candidate.language === "en")!;

    expect(sanitizePersistedCustomCards([card, { id: card.id, sourceKey: card.sourceKey }])).toEqual([card]);
  });

  it("persists and rehydrates complete custom card data alongside inventory progress", () => {
    const card = VOCABULARY_CARDS.find((candidate) => candidate.language === "en")!;
    const inventoryCard: InventoryCard = {
      cardId: card.sourceKey,
      status: "active",
      correctCount: 1,
      addedAt: "2026-01-01T00:00:00.000Z",
    };
    customCardRegistry.register(card);

    const options = useInventoryStore.persist.getOptions();
    const partialize = options.partialize;
    const merge = options.merge;
    expect(partialize).toBeTypeOf("function");
    expect(merge).toBeTypeOf("function");
    const persisted = partialize!({
      ...useInventoryStore.getState(),
      cards: [inventoryCard],
      ownerUserId: "user-1",
    });
    expect((persisted as { customCards: unknown }).customCards).toEqual([card]);

    customCardRegistry.clear();
    merge!(persisted, useInventoryStore.getState());

    expect(customCardRegistry.findBySourceKey(card.sourceKey)).toEqual(card);
  });

  it("writes card and quiz-progress changes to the local cache as they happen", async () => {
    const baseCard = VOCABULARY_CARDS.find((candidate) => candidate.language === "en" && candidate.tier === "A1")!;
    const cardId = "custom:cached-card";
    const card = { ...baseCard, id: `${cardId}:definition`, sourceKey: cardId };
    useLocalCardStudyStore.setState({ cards: {}, learnedReviewIntroSeen: false });

    useInventoryStore.getState().registerPendingCustomCard(card);
    await useInventoryStore.getState().recordAnswer({
      cardId,
      selectedAnswer: card.translation,
      correctAnswer: card.translation,
      isCorrect: true,
      mode: "active",
    });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as {
      state?: {
        cards?: InventoryCard[];
        attempts?: Array<{ cardId: string; isCorrect: boolean }>;
        customCards?: Array<{ id: string; grammarByLocale: unknown }>;
      };
    } | null;

    expect(stored?.state?.cards).toEqual([
      expect.objectContaining({ cardId, correctCount: 1, status: "active" }),
    ]);
    expect(stored?.state?.attempts?.[0]).toEqual(expect.objectContaining({ cardId, isCorrect: true }));
    expect(stored?.state?.customCards?.[0]).toEqual(expect.objectContaining({
      id: `${cardId}:definition`,
      grammarByLocale: card.grammarByLocale,
    }));
    expect(useLocalCardStudyStore.getState().cards[cardId]?.lastStudiedAt).toBeTruthy();
  });

  it("records study time locally before a cloud practice response resolves", async () => {
    const card = VOCABULARY_CARDS.find((candidate) => candidate.language === "en" && candidate.tier === "A1")!;
    useInventoryStore.setState({
      cards: [{
        cardId: card.sourceKey,
        status: "active",
        correctCount: 0,
        addedAt: "2026-01-01T00:00:00.000Z",
      }],
      cloudEnabled: true,
      ownerUserId: "user-1",
      pendingCardIds: new Set(),
    });

    let resolveCloudAction!: (result: Awaited<ReturnType<typeof recordCloudPracticeAttemptAction>>) => void;
    vi.mocked(recordCloudPracticeAttemptAction).mockImplementation(() => new Promise((resolve) => {
      resolveCloudAction = resolve;
    }));

    const pendingAnswer = useInventoryStore.getState().recordAnswer({
      cardId: card.sourceKey,
      selectedAnswer: "wrong",
      correctAnswer: card.translation,
      isCorrect: false,
      mode: "active",
    });

    expect(useLocalCardStudyStore.getState().cards[card.sourceKey]?.lastStudiedAt).toBeTruthy();

    resolveCloudAction({ status: "error", message: "Offline" });
    await pendingAnswer;
  });

  it("reconciles backend inventory and complete card details back into the local cache", async () => {
    const baseCard = VOCABULARY_CARDS.find((candidate) => candidate.language === "en")!;
    const cardId = "custom:server-refresh-card";
    const cachedCard = {
      ...baseCard,
      id: cardId,
      sourceKey: cardId,
      translation: "stale translation",
    };
    const refreshedCard = {
      ...cachedCard,
      translation: "fresh translation",
      translations: { ...cachedCard.translations, en: "fresh translation" },
    };
    const inventoryCard: InventoryCard = {
      cardId,
      status: "learned",
      correctCount: 2,
      addedAt: "2026-01-01T00:00:00.000Z",
      learnedAt: "2026-01-02T00:00:00.000Z",
    };
    const attempt: PracticeAttempt = {
      id: "server-attempt-1",
      cardId,
      selectedAnswer: "fresh translation",
      correctAnswer: "fresh translation",
      isCorrect: true,
      mode: "active",
      createdAt: "2026-01-02T00:00:00.000Z",
    };
    customCardRegistry.register(cachedCard);
    useInventoryStore.setState({
      cards: [{ ...inventoryCard, status: "active", correctCount: 0, learnedAt: undefined }],
      attempts: [],
      ownerUserId: "user-1",
      cloudEnabled: true,
    });
    vi.mocked(loadCustomCardsAction).mockResolvedValue({
      status: "success",
      message: "",
      data: [refreshedCard],
    });
    vi.mocked(listCloudInventoryAction).mockResolvedValue({
      status: "success",
      message: "",
      data: { cards: [inventoryCard], attempts: [attempt] },
    });

    await useInventoryStore.getState().loadCloudInventory();

    expect(useInventoryStore.getState().cards).toEqual([inventoryCard]);
    expect(useInventoryStore.getState().attempts).toEqual([attempt]);
    expect(customCardRegistry.findBySourceKey(cardId)?.translation).toBe("fresh translation");
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as {
      state?: { cards?: InventoryCard[]; attempts?: PracticeAttempt[]; customCards?: Array<{ translation: string }> };
    } | null;
    expect(stored?.state?.cards).toEqual([inventoryCard]);
    expect(stored?.state?.attempts).toEqual([attempt]);
    expect(stored?.state?.customCards?.[0]?.translation).toBe("fresh translation");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import {
  mergeCloudInventoryCards,
  reconcileSettledCardMutations,
  sanitizePersistedInventoryCards,
  useInventoryStore,
} from "./inventory-store";

describe("inventory optimistic card mutations", () => {
  beforeEach(() => {
    useInventoryStore.setState({
      cards: [],
      attempts: [],
      pendingCardIds: new Set(),
      pendingCardMutations: new Map(),
    });
  });

  it("drops only temporary offline-preview references from persisted inventory", () => {
    const durableCard = {
      cardId: "custom:user-1:card-1",
      status: "active" as const,
      correctCount: 2,
      addedAt: "2026-01-01T00:00:00.000Z",
    };
    const offlinePreview = {
      ...durableCard,
      cardId: "offline-pending:user-1:draft-12345678",
    };

    expect(sanitizePersistedInventoryCards([durableCard, offlinePreview, { cardId: 4 }])).toEqual([durableCard]);
  });

  it("updates removal immediately and restores the card and attempts on rollback", () => {
    useInventoryStore.setState({
      cards: [
        { cardId: "card-1", status: "active", correctCount: 2, addedAt: "2026-01-01" },
        { cardId: "card-2", status: "active", correctCount: 0, addedAt: "2026-01-02" },
      ],
      attempts: [
        {
          id: "attempt-1",
          cardId: "card-1",
          selectedAnswer: "a",
          correctAnswer: "b",
          isCorrect: false,
          mode: "active",
          createdAt: "2026-01-03",
        },
      ],
    });

    const mutation = useInventoryStore.getState().optimisticallyRemoveCard("card-1");

    expect(mutation).not.toBeNull();
    expect(useInventoryStore.getState().cards.map((card) => card.cardId)).toEqual(["card-2"]);
    expect(useInventoryStore.getState().attempts).toEqual([]);
    expect(useInventoryStore.getState().optimisticallyRemoveCard("card-1")).toBeNull();

    useInventoryStore.getState().rollbackOptimisticCardMutation(mutation!);

    expect(useInventoryStore.getState().cards.map((card) => card.cardId)).toEqual(["card-1", "card-2"]);
    expect(useInventoryStore.getState().attempts.map((attempt) => attempt.id)).toEqual(["attempt-1"]);
  });

  it("marks a card learned immediately and rolls it back without touching other cards", () => {
    useInventoryStore.setState({
      cards: [
        { cardId: "card-1", status: "active", correctCount: 1, addedAt: "2026-01-01" },
        { cardId: "card-2", status: "active", correctCount: 0, addedAt: "2026-01-02" },
      ],
    });

    const mutation = useInventoryStore.getState().optimisticallyMarkCardLearned("card-1");
    const optimisticCard = useInventoryStore.getState().cards[0];

    expect(mutation).not.toBeNull();
    expect(optimisticCard.status).toBe("learned");
    expect(useInventoryStore.getState().optimisticallyMarkCardLearned("card-1")).toBeNull();

    useInventoryStore.getState().rollbackOptimisticCardMutation(mutation!);

    expect(useInventoryStore.getState().cards).toEqual([
      { cardId: "card-1", status: "active", correctCount: 1, addedAt: "2026-01-01" },
      { cardId: "card-2", status: "active", correctCount: 0, addedAt: "2026-01-02" },
    ]);
  });

  it("keeps a settled removal hidden until a refresh confirms it", () => {
    useInventoryStore.setState({
      cloudEnabled: true,
      cards: [{ cardId: "card-1", status: "active", correctCount: 0, addedAt: "2026-01-01" }],
    });

    const mutation = useInventoryStore.getState().optimisticallyRemoveCard("card-1");
    expect(mutation).not.toBeNull();
    useInventoryStore.getState().settleOptimisticCardMutation(mutation!);

    const pending = useInventoryStore.getState().pendingCardMutations;
    expect(
      mergeCloudInventoryCards(
        [{ cardId: "card-1", status: "active", correctCount: 0, addedAt: "2026-01-01" }],
        [],
        new Set(),
        pending,
      ),
    ).toEqual([]);
    expect(reconcileSettledCardMutations(
      [{ cardId: "card-1", status: "active", correctCount: 0, addedAt: "2026-01-01" }],
      pending,
    ).has("card-1")).toBe(true);
    expect(reconcileSettledCardMutations([], pending).has("card-1")).toBe(false);
  });
});

"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import { localCardRepository } from "@/features/cards/card-repository";
import { FIRST_CARD_ADDED_EVENT } from "@/features/push/push-client";
import { STORAGE_KEY } from "@/lib/constants";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";
import { isFirstLearnedTransition } from "@/lib/twa-analytics-events";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, normalizeLocale } from "@/i18n/config";
import { translate } from "@/i18n/dictionaries";
import type { InventoryCard, LanguageCode, LimitErrorCode, PracticeAttempt, PracticeMode, TermKind, Tier, VocabularyCard } from "@/types/domain";
import type { GeneratedCardDraft } from "@/features/cards/custom-card-types";
import {
  addCloudInventoryCardAction,
  addCloudInventoryCardsAction,
  createCustomCardAction,
  listCloudInventoryAction,
  loadCustomCardsAction,
  migrateLocalInventoryToCloudAction,
  recordCloudPracticeAttemptAction,
  removeCloudInventoryCardAction,
  resetCloudInventoryAction,
} from "@/features/inventory/cloud-actions";
import {
  addCardToInventory,
  applyAnswerProgress,
  createPracticeAttempt,
} from "@/features/quiz/quiz-engine";
import { syncMissionsFromClientState } from "@/features/missions/mission-sync";
import { refreshLeaderboardPositions } from "@/features/leaderboard/leaderboard-refresh";

interface RecordAnswerResult {
  attempt: PracticeAttempt;
  inventoryCard: InventoryCard;
}

interface AddCardResult {
  ok: boolean;
  firstCardAdded: boolean;
  limitReached?: boolean;
}

interface AddCardsResult extends AddCardResult {
  addedCardIds: string[];
  remainingCardIds: string[];
}

interface InventoryCloudActionResult<T> {
  status: "success" | "error";
  message: string;
  errorCode?: LimitErrorCode;
  data?: T;
}

export type OptimisticCardMutationKind = "remove" | "mark-learned";

export interface OptimisticCardMutation {
  id: number;
  cardId: string;
  kind: OptimisticCardMutationKind;
  previousCard: InventoryCard;
  previousCardIndex: number;
  previousAttempts: Array<{ attempt: PracticeAttempt; index: number }>;
  optimisticLearnedAt?: string;
}

export interface PendingCardMutation extends OptimisticCardMutation {
  state: "pending" | "settled";
}

export class InventoryActionError extends Error {
  constructor(message: string, readonly errorCode?: LimitErrorCode) {
    super(message);
    this.name = "InventoryActionError";
  }
}

interface InventoryState {
  cards: InventoryCard[];
  attempts: PracticeAttempt[];
  ownerUserId: string | null;
  hydrated: boolean;
  cloudEnabled: boolean;
  cloudLoading: boolean;
  cloudLoadComplete: boolean;
  cloudError: string;
  activeCardLimit: number | null;
  pendingCardIds: Set<string>;
  pendingCardMutations: Map<string, PendingCardMutation>;
  optimisticallyRemoveCard: (cardId: string) => OptimisticCardMutation | null;
  optimisticallyMarkCardLearned: (cardId: string) => OptimisticCardMutation | null;
  settleOptimisticCardMutation: (mutation: OptimisticCardMutation) => void;
  rollbackOptimisticCardMutation: (mutation: OptimisticCardMutation) => void;
  setHydrated: (hydrated: boolean) => void;
  setCloudEnabled: (enabled: boolean) => void;
  setOwnerUserId: (userId: string | null) => void;
  setActiveCardLimit: (limit: number | null) => void;
  clearLocalInventory: () => void;
  loadCloudInventory: () => Promise<void>;
  migrateLocalInventoryToCloud: () => Promise<void>;
  addCard: (cardId: string) => Promise<AddCardResult>;
  addCards: (cardIds: string[]) => Promise<AddCardsResult>;
  removeCard: (cardId: string) => Promise<void>;
  hasCard: (cardId: string) => boolean;
  recordAnswer: (input: {
    cardId: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    mode: PracticeMode;
    forceLearned?: boolean;
  }) => Promise<RecordAnswerResult | undefined>;
  reset: () => Promise<void>;
  createCustomCard: (input: {
    language: LanguageCode;
    tier: Tier;
    termKind: TermKind;
    draft: GeneratedCardDraft;
    optimisticCard?: VocabularyCard;
    idempotencyKey?: string;
  }) => Promise<void>;
  registerPendingCustomCard: (card: VocabularyCard) => void;
}

const OFFLINE_PENDING_CARD_PREFIX = "offline-pending:";

/**
 * Offline-note previews are reconstructible from their durable IndexedDB draft.
 * Never let their temporary IDs become durable inventory references: a reload
 * clears the in-memory custom-card registry, so those references cannot resolve
 * until the offline queue has been rehydrated.
 */
export function sanitizePersistedInventoryCards(value: unknown): InventoryCard[] {
  if (!Array.isArray(value)) return [];

  return value.filter((candidate): candidate is InventoryCard => {
    if (!candidate || typeof candidate !== "object") return false;
    const card = candidate as Partial<InventoryCard>;
    return typeof card.cardId === "string" &&
      card.cardId.length > 0 &&
      card.cardId.length <= 512 &&
      !card.cardId.startsWith(OFFLINE_PENDING_CARD_PREFIX) &&
      (card.status === "active" || card.status === "learned") &&
      Number.isSafeInteger(card.correctCount) &&
      (card.correctCount ?? -1) >= 0 &&
      typeof card.addedAt === "string" &&
      (card.learnedAt === undefined || typeof card.learnedAt === "string");
  });
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      cards: [],
      attempts: [],
      ownerUserId: null,
      hydrated: false,
      cloudEnabled: false,
      cloudLoading: false,
      cloudLoadComplete: true,
      cloudError: "",
      activeCardLimit: null,
      pendingCardIds: new Set(),
      pendingCardMutations: new Map(),

      setHydrated(hydrated) {
        set({ hydrated });
      },

      setCloudEnabled(enabled) {
        if (get().cloudEnabled === enabled) {
          return;
        }

        set({
          cloudEnabled: enabled,
          cloudLoading: false,
          cloudLoadComplete: !enabled,
          cloudError: "",
        });
      },

      setOwnerUserId(userId) {
        set({ ownerUserId: userId });
      },

      setActiveCardLimit(limit) {
        set({ activeCardLimit: limit });
      },

      clearLocalInventory() {
        set({
          cards: [],
          attempts: [],
          ownerUserId: null,
          pendingCardIds: new Set(),
          pendingCardMutations: new Map(),
        });
      },

      async loadCloudInventory() {
        if (!get().cloudEnabled) {
          return;
        }

        set({ cloudLoading: true, cloudLoadComplete: false, cloudError: "" });

        try {
          const [inventoryResult, customCardsResult] = await Promise.all([
            runInventoryCloudAction("load inventory", listCloudInventoryAction),
            runInventoryCloudAction("load custom cards", loadCustomCardsAction),
          ]);

          if (customCardsResult.status === "success" && customCardsResult.data) {
            customCardRegistry.clear();
            for (const card of customCardsResult.data) {
              customCardRegistry.register(card);
            }
          }

          if (inventoryResult.status === "error" || !inventoryResult.data) {
            set({ cloudLoading: false, cloudLoadComplete: true, cloudError: inventoryResult.message });
            return;
          }

          const currentState = get();
          const nextPendingCardMutations = reconcileSettledCardMutations(
            inventoryResult.data.cards,
            currentState.pendingCardMutations,
          );
          set({
            cards: mergeCloudInventoryCards(
              inventoryResult.data.cards,
              currentState.cards,
              currentState.pendingCardIds,
              currentState.pendingCardMutations,
            ),
            attempts: inventoryResult.data.attempts,
            pendingCardMutations: nextPendingCardMutations,
            cloudLoading: false,
            cloudLoadComplete: true,
            cloudError: "",
          });
        } catch (error) {
          set({
            cloudLoading: false,
            cloudLoadComplete: true,
            cloudError: error instanceof Error ? error.message : "Failed to load cloud inventory",
          });
        }
      },

      optimisticallyRemoveCard(cardId) {
        const state = get();
        if (state.pendingCardMutations.has(cardId)) return null;

        const cardIndex = state.cards.findIndex((card) => card.cardId === cardId);
        if (cardIndex < 0) return null;

        const previousCard = state.cards[cardIndex];
        const previousAttempts = state.attempts.flatMap((attempt, index) =>
          attempt.cardId === cardId ? [{ attempt, index }] : [],
        );
        const mutation: OptimisticCardMutation = {
          id: nextOptimisticCardMutationId(),
          cardId,
          kind: "remove",
          previousCard,
          previousCardIndex: cardIndex,
          previousAttempts,
        };
        const pendingCardMutations = new Map(state.pendingCardMutations);
        pendingCardMutations.set(cardId, { ...mutation, state: "pending" });
        set({
          cards: state.cards.filter((card) => card.cardId !== cardId),
          attempts: state.attempts.filter((attempt) => attempt.cardId !== cardId),
          pendingCardMutations,
        });
        return mutation;
      },

      optimisticallyMarkCardLearned(cardId) {
        const state = get();
        if (state.pendingCardMutations.has(cardId)) return null;

        const cardIndex = state.cards.findIndex((card) => card.cardId === cardId);
        if (cardIndex < 0 || state.cards[cardIndex].status === "learned") return null;

        const previousCard = state.cards[cardIndex];
        const optimisticLearnedAt = new Date().toISOString();
        const mutation: OptimisticCardMutation = {
          id: nextOptimisticCardMutationId(),
          cardId,
          kind: "mark-learned",
          previousCard,
          previousCardIndex: cardIndex,
          previousAttempts: [],
          optimisticLearnedAt,
        };
        const pendingCardMutations = new Map(state.pendingCardMutations);
        pendingCardMutations.set(cardId, { ...mutation, state: "pending" });
        set({
          cards: state.cards.map((card, index) =>
            index === cardIndex
              ? { ...card, status: "learned", learnedAt: optimisticLearnedAt }
              : card,
          ),
          pendingCardMutations,
        });
        return mutation;
      },

      settleOptimisticCardMutation(mutation) {
        const state = get();
        const current = state.pendingCardMutations.get(mutation.cardId);
        if (!current || current.id !== mutation.id) return;

        const pendingCardMutations = new Map(state.pendingCardMutations);
        pendingCardMutations.set(mutation.cardId, { ...current, state: "settled" });
        set({ pendingCardMutations });
      },

      rollbackOptimisticCardMutation(mutation) {
        const state = get();
        const current = state.pendingCardMutations.get(mutation.cardId);
        if (!current || current.id !== mutation.id) return;

        let cards = state.cards;
        let attempts = state.attempts;
        if (mutation.kind === "remove") {
          if (!cards.some((card) => card.cardId === mutation.cardId)) {
            const nextCards = [...cards];
            nextCards.splice(
              Math.min(mutation.previousCardIndex, nextCards.length),
              0,
              mutation.previousCard,
            );
            cards = nextCards;
          }

          const existingAttemptIds = new Set(attempts.map((attempt) => attempt.id));
          const nextAttempts = [...attempts];
          mutation.previousAttempts.forEach(({ attempt, index }) => {
            if (existingAttemptIds.has(attempt.id)) return;
            nextAttempts.splice(Math.min(index, nextAttempts.length), 0, attempt);
          });
          attempts = nextAttempts;
        } else {
          const currentCard = cards.find((card) => card.cardId === mutation.cardId);
          if (currentCard?.learnedAt === mutation.optimisticLearnedAt) {
            cards = cards.map((card) =>
              card.cardId === mutation.cardId ? mutation.previousCard : card,
            );
          }
        }

        const pendingCardMutations = new Map(state.pendingCardMutations);
        pendingCardMutations.delete(mutation.cardId);
        set({ cards, attempts, pendingCardMutations });
      },

      async migrateLocalInventoryToCloud() {
        if (!get().cloudEnabled) {
          return;
        }

        set({ cloudLoading: true, cloudLoadComplete: false, cloudError: "" });
        const result = await runInventoryCloudAction(
          "migrate local inventory",
          () => migrateLocalInventoryToCloudAction(get().cards),
        );

        if (result.status === "error" || !result.data) {
          set({ cloudLoading: false, cloudLoadComplete: true, cloudError: result.message });
          return;
        }

        set({
          cards: result.data.cards,
          attempts: result.data.attempts,
          cloudLoading: false,
          cloudLoadComplete: true,
          cloudError: "",
        });

        await syncMissionsFromClientState();
      },

      async addCard(cardId) {
        const previousCount = get().cards.length;

        if (get().cloudEnabled) {
          const { activeCardLimit } = get();
          const activeCount = get().cards.filter((card) => card.status === "active").length;

          if (activeCardLimit !== null && activeCount >= activeCardLimit) {
            return { ok: false, firstCardAdded: false, limitReached: true };
          }

          const cardWasAlreadyPresent = get().cards.some((card) => card.cardId === cardId);
          const optimisticCards = addCardToInventory(get().cards, cardId);
          set({ cards: optimisticCards });
          addPendingCardId(set, cardId);

          set({ cloudLoading: true, cloudError: "" });
          const result = await runInventoryCloudAction(
            "add card",
            () => enqueueCloudCardAddition(get().ownerUserId, () => addCloudInventoryCardAction(cardId)),
          );
          removePendingCardId(set, cardId);

          if (result.status === "error" || !result.data) {
            const currentState = get();
            set({
              cards: cardWasAlreadyPresent
                ? currentState.cards
                : currentState.cards.filter((card) => card.cardId !== cardId),
              cloudLoading: currentState.pendingCardIds.size > 0,
              cloudError: result.message,
            });
            return { ok: false, firstCardAdded: false };
          }

          if (get().cards.some((card) => card.cardId === cardId)) {
            const currentState = get();
            set({
              cards: mergeCloudInventoryCards(
                result.data.cards,
                currentState.cards,
                currentState.pendingCardIds,
                currentState.pendingCardMutations,
              ),
              attempts: result.data.attempts,
              cloudLoading: currentState.pendingCardIds.size > 0,
              cloudError: "",
            });
          } else {
            set({ cloudLoading: get().pendingCardIds.size > 0, cloudError: "" });
          }

          const firstCardAdded = previousCount === 0 && result.data.cards.length > 0;
          const addedCard = localCardRepository.findById(cardId);

          if (addedCard) {
            sendTwaAnalyticsEvent("fd_card_added", {
              params: {
                card_id: addedCard.id,
                card_language: addedCard.language,
                card_tier: addedCard.tier,
                term_kind: addedCard.termKind,
              },
            });
          }
          if (result.data.cards.length > 0) {
            sendTwaAnalyticsEvent("fd_first_card_added", { once: true });
          }
          if (firstCardAdded) {
            dispatchFirstCardAddedEvent();
          }

          await syncMissionsFromClientState();

          return { ok: true, firstCardAdded };
        }

        const nextCards = addCardToInventory(get().cards, cardId);
        set({ cards: nextCards });
        const firstCardAdded = previousCount === 0 && nextCards.length > 0;
        const addedCard = localCardRepository.findById(cardId);

        if (addedCard) {
          sendTwaAnalyticsEvent("fd_card_added", {
            params: {
              card_id: addedCard.id,
              card_language: addedCard.language,
              card_tier: addedCard.tier,
              term_kind: addedCard.termKind,
            },
          });
        }
        if (nextCards.length > 0) {
          sendTwaAnalyticsEvent("fd_first_card_added", { once: true });
        }
        if (firstCardAdded) {
          dispatchFirstCardAddedEvent();
        }

        void syncMissionsFromClientState();

        return { ok: true, firstCardAdded };
      },

      async addCards(cardIds) {
        const requestedCardIds = [...new Set(cardIds.filter((cardId) => typeof cardId === "string" && cardId.trim().length > 0))];
        const previousCount = get().cards.length;

        if (requestedCardIds.length === 0) {
          return {
            ok: true,
            firstCardAdded: false,
            addedCardIds: [],
            remainingCardIds: [],
          };
        }

        if (get().cloudEnabled) {
          const existingIds = new Set(get().cards.map((card) => card.cardId));
          const newCardIds = requestedCardIds.filter((cardId) => !existingIds.has(cardId));
          const activeCount = get().cards.filter((card) => card.status === "active").length;
          const activeCardLimit = get().activeCardLimit;
          const availableSlots = activeCardLimit === null
            ? newCardIds.length
            : Math.max(0, activeCardLimit - activeCount);
          const optimisticCardIds = newCardIds.slice(0, availableSlots);

          if (optimisticCardIds.length > 0) {
            set((state) => ({
              ...state,
              cards: optimisticCardIds.reduce(
                (cards, cardId) => addCardToInventory(cards, cardId),
                state.cards,
              ),
              pendingCardIds: new Set([...state.pendingCardIds, ...optimisticCardIds]),
              cloudLoading: true,
              cloudError: "",
            }));
          } else {
            set({ cloudLoading: true, cloudError: "" });
          }

          const result = await runInventoryCloudAction(
            "add cards",
            () => enqueueCloudCardAddition(
              get().ownerUserId,
              () => addCloudInventoryCardsAction(requestedCardIds),
            ),
          );

          if (result.status === "error" || !result.data) {
            set((state) => {
              const optimisticCardIdSet = new Set(optimisticCardIds);
              const pendingCardIds = new Set(state.pendingCardIds);
              optimisticCardIds.forEach((cardId) => pendingCardIds.delete(cardId));

              return {
                ...state,
                cards: state.cards.filter((card) => !optimisticCardIdSet.has(card.cardId)),
                pendingCardIds,
                cloudLoading: pendingCardIds.size > 0,
                cloudError: result.message,
              };
            });
            return {
              ok: false,
              firstCardAdded: false,
              addedCardIds: [],
              remainingCardIds: requestedCardIds,
            };
          }

          const cloudData = result.data;
          if (!cloudData) {
            return {
              ok: false,
              firstCardAdded: false,
              addedCardIds: [],
              remainingCardIds: requestedCardIds,
            };
          }

          const { addedCardIds, remainingCardIds } = cloudData;
          set((state) => {
            const pendingCardIds = new Set(state.pendingCardIds);
            optimisticCardIds.forEach((cardId) => pendingCardIds.delete(cardId));

            return {
              ...state,
              cards: cloudData.cards,
              attempts: cloudData.attempts,
              pendingCardIds,
              pendingCardMutations: new Map(),
              cloudLoading: pendingCardIds.size > 0,
              cloudError: "",
            };
          });

          for (const cardId of addedCardIds) {
            const addedCard = localCardRepository.findById(cardId);
            if (!addedCard) continue;

            sendTwaAnalyticsEvent("fd_card_added", {
              params: {
                card_id: addedCard.id,
                card_language: addedCard.language,
                card_tier: addedCard.tier,
                term_kind: addedCard.termKind,
              },
            });
          }

          if (addedCardIds.length > 0) {
            sendTwaAnalyticsEvent("fd_first_card_added", { once: true });
          }

          const firstCardAdded = previousCount === 0 && result.data.cards.length > 0;
          if (firstCardAdded) {
            dispatchFirstCardAddedEvent();
          }

          await syncMissionsFromClientState();

          return {
            ok: true,
            firstCardAdded,
            addedCardIds,
            remainingCardIds,
            limitReached: remainingCardIds.length > 0,
          };
        }

        const existingIds = new Set(get().cards.map((card) => card.cardId));
        const newCardIds = requestedCardIds.filter((cardId) => !existingIds.has(cardId));
        const activeCount = get().cards.filter((card) => card.status === "active").length;
        const activeCardLimit = get().activeCardLimit;
        const availableSlots = activeCardLimit === null
          ? newCardIds.length
          : Math.max(0, activeCardLimit - activeCount);
        const addedCardIds = newCardIds.slice(0, availableSlots);
        const remainingCardIds = newCardIds.slice(addedCardIds.length);
        const nextCards = addedCardIds.reduce(
          (cards, cardId) => addCardToInventory(cards, cardId),
          get().cards,
        );

        set({ cards: nextCards });

        for (const cardId of addedCardIds) {
          const addedCard = localCardRepository.findById(cardId);
          if (!addedCard) continue;

          sendTwaAnalyticsEvent("fd_card_added", {
            params: {
              card_id: addedCard.id,
              card_language: addedCard.language,
              card_tier: addedCard.tier,
              term_kind: addedCard.termKind,
            },
          });
        }

        if (addedCardIds.length > 0) {
          sendTwaAnalyticsEvent("fd_first_card_added", { once: true });
        }

        const firstCardAdded = previousCount === 0 && nextCards.length > 0;
        if (firstCardAdded) {
          dispatchFirstCardAddedEvent();
        }

        void syncMissionsFromClientState();

        return {
          ok: true,
          firstCardAdded,
          addedCardIds,
          remainingCardIds,
          limitReached: remainingCardIds.length > 0,
        };
      },

      async removeCard(cardId) {
        if (get().cloudEnabled) {
          set({ cloudLoading: true, cloudError: "" });
          addPendingCardId(set, cardId);

          const previousCards = get().cards;
          const previousAttempts = get().attempts;
          set({
            cards: previousCards.filter((card) => card.cardId !== cardId),
            attempts: previousAttempts.filter((attempt) => attempt.cardId !== cardId),
          });

          const result = await runInventoryCloudAction(
            "remove card",
            () => removeCloudInventoryCardAction(cardId),
          );
          removePendingCardId(set, cardId);

          if (result.status === "error" || !result.data) {
            set({
              cards: previousCards,
              attempts: previousAttempts,
              cloudLoading: false,
              cloudError: result.message,
            });
            return;
          }

          set({
            cards: result.data.cards,
            attempts: result.data.attempts,
            cloudLoading: false,
            cloudError: "",
          });
          await syncMissionsFromClientState();
          return;
        }

        set((state) => ({
          cards: state.cards.filter((card) => card.cardId !== cardId),
          attempts: state.attempts.filter((attempt) => attempt.cardId !== cardId),
        }));

        void syncMissionsFromClientState();
      },

      hasCard(cardId) {
        return get().cards.some((card) => card.cardId === cardId);
      },

      async recordAnswer(input) {
        if (get().cloudEnabled && get().pendingCardIds.has(input.cardId)) {
          await waitForCloudCardAddition(get().ownerUserId);
        }

        const vocabularyCard = localCardRepository.findById(input.cardId);
        const ownedCard = get().cards.find((card) => card.cardId === input.cardId);

        if (get().cloudEnabled) {
          const previousCards = get().cards;
          const previousAttempts = get().attempts;

          let optimisticCards = previousCards;
          let optimisticAttempts = previousAttempts;

          if (vocabularyCard && ownedCard && input.mode !== "learned") {
            const updatedCard = applyAnswerProgress(
              ownedCard,
              vocabularyCard,
              input.isCorrect,
              undefined,
            );
            optimisticCards = previousCards.map((card) =>
              card.cardId === input.cardId ? updatedCard : card,
            );
          }

          const optimisticAttempt = createPracticeAttempt(input);
          optimisticAttempts = [optimisticAttempt, ...previousAttempts].slice(0, 100);

          set({
            cards: optimisticCards,
            attempts: optimisticAttempts,
            cloudLoading: true,
            cloudError: "",
          });

          const serverInput = {
            cardId: input.cardId,
            selectedAnswer: input.selectedAnswer,
            correctAnswer: input.correctAnswer,
            isCorrect: input.isCorrect,
            mode: input.mode,
          };
          const result = await runInventoryCloudAction(
            "record practice answer",
            () => recordCloudPracticeAttemptAction(serverInput),
          );

          if (result.status === "error" || !result.data) {
            set({
              cards: previousCards,
              attempts: previousAttempts,
              cloudLoading: false,
              cloudError: result.message,
            });
            if (result.errorCode) {
              throw new InventoryActionError(result.message, result.errorCode);
            }
            return undefined;
          }

          const inventoryCard = result.data.cards.find((card) => card.cardId === input.cardId);
          const attempt = result.data.attempts.find(
            (item) =>
              item.cardId === input.cardId &&
              item.selectedAnswer === input.selectedAnswer &&
              item.correctAnswer === input.correctAnswer,
          );

          set({
            cards: result.data.cards,
            attempts: result.data.attempts,
            cloudLoading: false,
            cloudError: "",
          });

          const didLearnCard = inventoryCard && isFirstLearnedTransition(ownedCard?.status ?? "active", inventoryCard.status);

          if (didLearnCard) {
            sendTwaAnalyticsEvent("fd_card_learned", {
              params: {
                card_id: inventoryCard.cardId,
                card_language: vocabularyCard?.language ?? "",
                card_tier: vocabularyCard?.tier ?? "",
                term_kind: vocabularyCard?.termKind ?? "",
                correct_count: inventoryCard.correctCount,
              },
            });
          }

          if (didLearnCard) {
            refreshLeaderboardPositions();
          }

          await syncMissionsFromClientState();

          return inventoryCard && attempt ? { inventoryCard, attempt } : undefined;
        }

        if (!vocabularyCard || !ownedCard) {
          return undefined;
        }

        const updatedCard =
          input.mode === "learned"
            ? ownedCard
            : applyAnswerProgress(ownedCard, vocabularyCard, input.isCorrect, undefined, input.forceLearned);
        const attempt = createPracticeAttempt(input);

        set((state) => ({
          cards: state.cards.map((card) => (card.cardId === input.cardId ? updatedCard : card)),
          attempts: [attempt, ...state.attempts].slice(0, 100),
        }));

        if (isFirstLearnedTransition(ownedCard.status, updatedCard.status)) {
          sendTwaAnalyticsEvent("fd_card_learned", {
            params: {
              card_id: updatedCard.cardId,
              card_language: vocabularyCard.language,
              card_tier: vocabularyCard.tier,
              term_kind: vocabularyCard.termKind,
              correct_count: updatedCard.correctCount,
            },
          });
        }

        void syncMissionsFromClientState();

        return {
          attempt,
          inventoryCard: updatedCard,
        };
      },

      async reset() {
        if (get().cloudEnabled) {
          set({ cloudLoading: true, cloudError: "" });
          const result = await runInventoryCloudAction("reset inventory", resetCloudInventoryAction);

          if (result.status === "error" || !result.data) {
            set({ cloudLoading: false, cloudError: result.message });
            return;
          }

          customCardRegistry.clear();

          set({
            cards: result.data.cards,
            attempts: result.data.attempts,
            cloudLoading: false,
            cloudError: "",
          });
          await syncMissionsFromClientState();
          return;
        }

        customCardRegistry.clear();

        set({
          cards: [],
          attempts: [],
          ownerUserId: null,
          pendingCardMutations: new Map(),
        });

        void syncMissionsFromClientState();
      },

      async createCustomCard(input) {
        const optimisticCard = input.optimisticCard;
        const optimisticCardId = optimisticCard?.sourceKey;
        const request = {
          language: input.language,
          tier: input.tier,
          termKind: input.termKind,
          draft: input.draft,
        };

        if (optimisticCard && optimisticCardId) {
          customCardRegistry.register(optimisticCard);
          set({
            cards: addCardToInventory(get().cards, optimisticCardId),
            cloudLoading: true,
            cloudError: "",
          });
          addPendingCardId(set, optimisticCardId);
        } else {
          set({ cloudLoading: true, cloudError: "" });
        }

        let result: Awaited<ReturnType<typeof createCustomCardAction>>;
        try {
          result = input.idempotencyKey
            ? await createCustomCardThroughOfflineRoute(input)
            : await createCustomCardAction(request);
        } catch (error) {
          if (optimisticCardId) {
            customCardRegistry.unregister(optimisticCardId);
            removePendingCardId(set, optimisticCardId);
            set({
              cards: get().cards.filter((card) => card.cardId !== optimisticCardId),
              cloudLoading: get().pendingCardIds.size > 0,
              cloudError: "",
            });
          } else {
            set({ cloudLoading: false, cloudError: "" });
          }
          throw error;
        }

        if (result.status === "error" || !result.data) {
          const message = getCloudActionErrorMessage(result);
          if (optimisticCardId) {
            customCardRegistry.unregister(optimisticCardId);
            removePendingCardId(set, optimisticCardId);
            set({
              cards: get().cards.filter((card) => card.cardId !== optimisticCardId),
              cloudLoading: get().pendingCardIds.size > 0,
              cloudError: input.idempotencyKey ? "" : message,
            });
          } else {
            set({ cloudLoading: false, cloudError: message });
          }
          throw new InventoryActionError(message, result.errorCode);
        }

        const created = result.data;
        if (optimisticCardId) {
          customCardRegistry.unregister(optimisticCardId);
          removePendingCardId(set, optimisticCardId);
        }
        customCardRegistry.register(created.vocabularyCard);

        set({
          cards: [
            created.card,
            ...get().cards.filter(
              (card) => card.cardId !== created.card.cardId && card.cardId !== optimisticCardId,
            ),
          ],
          cloudLoading: false,
          cloudError: "",
        });

        sendTwaAnalyticsEvent("fd_custom_card_added", {
          params: {
            card_id: created.card.cardId,
            card_language: created.vocabularyCard.language,
            card_tier: created.vocabularyCard.tier,
            term_kind: created.vocabularyCard.termKind,
          },
        });

        await syncMissionsFromClientState();
      },

      registerPendingCustomCard(card) {
        customCardRegistry.register(card);
        set((state) => ({
          ...state,
          cards: addCardToInventory(state.cards, card.sourceKey),
          cloudError: "",
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cards: sanitizePersistedInventoryCards(state.cards),
        attempts: state.attempts,
        ownerUserId: state.ownerUserId,
      }),
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== "object") return currentState;
        const persisted = persistedState as Partial<InventoryState>;
        return {
          ...currentState,
          ...persisted,
          cards: Array.isArray(persisted.cards)
            ? sanitizePersistedInventoryCards(persisted.cards)
            : currentState.cards,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

function addPendingCardId(set: (fn: (state: InventoryState) => InventoryState) => void, cardId: string) {
  set((state) => ({
    ...state,
    pendingCardIds: new Set(state.pendingCardIds).add(cardId),
  }));
}

async function runInventoryCloudAction<T>(
  operation: string,
  action: () => Promise<InventoryCloudActionResult<T>>,
): Promise<InventoryCloudActionResult<T>> {
  try {
    return await action();
  } catch (error) {
    try {
      console.error("[FoxiesDeck inventory] Cloud action rejected unexpectedly.", {
        operation,
        error,
      });
    } catch {
      // Logging must not prevent optimistic state from being rolled back.
    }

    let locale = DEFAULT_LOCALE;
    try {
      locale = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    } catch {
      // The default locale keeps recovery available when browser storage is blocked.
    }

    return {
      status: "error",
      message: translate(locale, "inventory.error.operationFailed"),
    };
  }
}

function removePendingCardId(set: (fn: (state: InventoryState) => InventoryState) => void, cardId: string) {
  set((state) => {
    const next = new Set(state.pendingCardIds);
    next.delete(cardId);
    return { ...state, pendingCardIds: next };
  });
}

const cloudCardAddQueues = new Map<string, Promise<void>>();

function enqueueCloudCardAddition<T>(ownerUserId: string | null, operation: () => Promise<T>): Promise<T> {
  const queueKey = ownerUserId ?? "active-session";
  const previous = cloudCardAddQueues.get(queueKey) ?? Promise.resolve();
  const queuedOperation = previous.catch(() => undefined).then(operation);

  cloudCardAddQueues.set(
    queueKey,
    queuedOperation.then(
      () => undefined,
      () => undefined,
    ),
  );

  return queuedOperation;
}

async function waitForCloudCardAddition(ownerUserId: string | null) {
  const queue = cloudCardAddQueues.get(ownerUserId ?? "active-session");
  if (!queue) return;

  await queue.catch(() => undefined);
}

export function mergeCloudInventoryCards(
  cloudCards: InventoryCard[],
  localCards: InventoryCard[],
  pendingCardIds: ReadonlySet<string>,
  pendingCardMutations: ReadonlyMap<string, PendingCardMutation> = new Map(),
) {
  const pendingCards = localCards.filter((card) => pendingCardIds.has(card.cardId));
  const pendingIds = new Set(pendingCards.map((card) => card.cardId));
  const pendingMutationCards = localCards.filter((card) => {
    const mutation = pendingCardMutations.get(card.cardId);
    return mutation?.kind === "mark-learned";
  });
  pendingMutationCards.forEach((card) => pendingIds.add(card.cardId));

  const removedCardIds = new Set(
    [...pendingCardMutations.values()]
      .filter((mutation) => mutation.kind === "remove")
      .map((mutation) => mutation.cardId),
  );

  return [
    ...pendingCards,
    ...pendingMutationCards.filter((card) => !pendingCardIds.has(card.cardId)),
    ...cloudCards.filter(
      (card) => !pendingIds.has(card.cardId) && !removedCardIds.has(card.cardId),
    ),
  ];
}

async function createCustomCardThroughOfflineRoute(input: {
  language: LanguageCode;
  tier: Tier;
  termKind: TermKind;
  draft: GeneratedCardDraft;
  idempotencyKey?: string;
}): Promise<Awaited<ReturnType<typeof createCustomCardAction>>> {
  if (!input.idempotencyKey) throw new Error("offline_custom_card_idempotency_key_required");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/cards/offline-create", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: input.idempotencyKey,
        language: input.language,
        tier: input.tier,
        termKind: input.termKind,
        term: input.draft.term,
        partOfSpeech: input.draft.partOfSpeech,
        pronunciation: input.draft.pronunciation,
        translations: input.draft.translations,
        examples: input.draft.examples.map((example) => ({
          sentence: example.example,
          translation: example.translation,
        })),
        definitions: input.draft.definitions,
        grammar: input.draft.grammar,
      }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null) as Awaited<ReturnType<typeof createCustomCardAction>> | null;
    if (!result || (result.status !== "success" && result.status !== "error")) {
      throw new Error("offline_custom_card_invalid_response");
    }
    if (!response.ok && result.status !== "error") {
      throw new Error("offline_custom_card_request_failed");
    }
    return result;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function reconcileSettledCardMutations(
  cloudCards: InventoryCard[],
  pendingCardMutations: ReadonlyMap<string, PendingCardMutation>,
) {
  const cloudCardsById = new Map(cloudCards.map((card) => [card.cardId, card]));
  const next = new Map(pendingCardMutations);

  for (const [cardId, mutation] of pendingCardMutations) {
    if (mutation.state !== "settled") continue;

    const cloudCard = cloudCardsById.get(cardId);
    const mutationCommitted =
      mutation.kind === "remove"
        ? !cloudCard
        : cloudCard?.status === "learned";
    if (mutationCommitted) next.delete(cardId);
  }

  return next;
}

let optimisticCardMutationId = 0;

function nextOptimisticCardMutationId() {
  optimisticCardMutationId += 1;
  return optimisticCardMutationId;
}

function getCloudActionErrorMessage(result: { message?: string; errorCode?: string }) {
  const message = result.message?.trim();

  if (message) {
    return message;
  }

  return result.errorCode?.trim() || "unknown";
}

function dispatchFirstCardAddedEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(FIRST_CARD_ADDED_EVENT));
}

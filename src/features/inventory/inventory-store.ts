"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import { localCardRepository } from "@/features/cards/card-repository";
import { FIRST_CARD_ADDED_EVENT } from "@/features/push/push-client";
import { STORAGE_KEY } from "@/lib/constants";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";
import { isFirstLearnedTransition } from "@/lib/twa-analytics-events";
import type { InventoryCard, LanguageCode, PracticeAttempt, PracticeMode, TermKind, Tier } from "@/types/domain";
import type { GeneratedCardDraft } from "@/features/cards/custom-card-types";
import {
  addCloudInventoryCardAction,
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

interface RecordAnswerResult {
  attempt: PracticeAttempt;
  inventoryCard: InventoryCard;
}

interface AddCardResult {
  ok: boolean;
  firstCardAdded: boolean;
  limitReached?: boolean;
}

interface InventoryState {
  cards: InventoryCard[];
  attempts: PracticeAttempt[];
  ownerUserId: string | null;
  hydrated: boolean;
  cloudEnabled: boolean;
  cloudLoading: boolean;
  cloudError: string;
  activeCardLimit: number | null;
  pendingCardIds: Set<string>;
  setHydrated: (hydrated: boolean) => void;
  setCloudEnabled: (enabled: boolean) => void;
  setOwnerUserId: (userId: string | null) => void;
  setActiveCardLimit: (limit: number | null) => void;
  clearLocalInventory: () => void;
  loadCloudInventory: () => Promise<void>;
  migrateLocalInventoryToCloud: () => Promise<void>;
  addCard: (cardId: string) => Promise<AddCardResult>;
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
  }) => Promise<void>;
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
      cloudError: "",
      activeCardLimit: null,
      pendingCardIds: new Set(),

      setHydrated(hydrated) {
        set({ hydrated });
      },

      setCloudEnabled(enabled) {
        set({ cloudEnabled: enabled, cloudError: enabled ? get().cloudError : "" });
      },

      setOwnerUserId(userId) {
        set({ ownerUserId: userId });
      },

      setActiveCardLimit(limit) {
        set({ activeCardLimit: limit });
      },

      clearLocalInventory() {
        set({ cards: [], attempts: [], ownerUserId: null, pendingCardIds: new Set() });
      },

      async loadCloudInventory() {
        if (!get().cloudEnabled) {
          return;
        }

        set({ cloudLoading: true, cloudError: "" });

        try {
          const [inventoryResult, customCardsResult] = await Promise.all([
            listCloudInventoryAction(),
            loadCustomCardsAction(),
          ]);

          if (customCardsResult.status === "success" && customCardsResult.data) {
            customCardRegistry.clear();
            for (const card of customCardsResult.data) {
              customCardRegistry.register(card);
            }
          }

          if (inventoryResult.status === "error" || !inventoryResult.data) {
            set({ cloudLoading: false, cloudError: inventoryResult.message });
            return;
          }

          set({
            cards: inventoryResult.data.cards,
            attempts: inventoryResult.data.attempts,
            cloudLoading: false,
            cloudError: "",
          });
        } catch (error) {
          set({
            cloudLoading: false,
            cloudError: error instanceof Error ? error.message : "Failed to load cloud inventory",
          });
        }
      },

      async migrateLocalInventoryToCloud() {
        if (!get().cloudEnabled) {
          return;
        }

        set({ cloudLoading: true, cloudError: "" });
        const result = await migrateLocalInventoryToCloudAction(get().cards);

        if (result.status === "error" || !result.data) {
          set({ cloudLoading: false, cloudError: result.message });
          return;
        }

        set({
          cards: result.data.cards,
          attempts: result.data.attempts,
          cloudLoading: false,
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

          const optimisticCards = addCardToInventory(get().cards, cardId);
          set({ cards: optimisticCards });
          addPendingCardId(set, cardId);

          set({ cloudLoading: true, cloudError: "" });
          const result = await addCloudInventoryCardAction(cardId);
          removePendingCardId(set, cardId);

          if (result.status === "error" || !result.data) {
            if (get().cards.some((card) => card.cardId === cardId)) {
              set({
                cards: get().cards.filter((card) => card.cardId !== cardId),
                cloudLoading: false,
                cloudError: result.message,
              });
            } else {
              set({ cloudLoading: false, cloudError: result.message });
            }
            return { ok: false, firstCardAdded: false };
          }

          if (get().cards.some((card) => card.cardId === cardId)) {
            set({
              cards: result.data.cards,
              attempts: result.data.attempts,
              cloudLoading: false,
              cloudError: "",
            });
          } else {
            set({ cloudLoading: false, cloudError: "" });
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

          const result = await removeCloudInventoryCardAction(cardId);
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
              input.forceLearned,
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

          const result = await recordCloudPracticeAttemptAction(input);

          if (result.status === "error" || !result.data) {
            set({
              cards: previousCards,
              attempts: previousAttempts,
              cloudLoading: false,
              cloudError: result.message,
            });
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

          if (inventoryCard && isFirstLearnedTransition(ownedCard?.status ?? "active", inventoryCard.status)) {
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
          const result = await resetCloudInventoryAction();

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
        });

        void syncMissionsFromClientState();
      },

      async createCustomCard(input) {
        set({ cloudLoading: true, cloudError: "" });

        const result = await createCustomCardAction(input);

        if (result.status === "error" || !result.data) {
          const message = getCloudActionErrorMessage(result);
          set({ cloudLoading: false, cloudError: message });
          throw new Error(message);
        }

        const created = result.data;
        customCardRegistry.register(created.vocabularyCard);

        set({
          cards: [
            created.card,
            ...get().cards.filter((card) => card.cardId !== created.card.cardId),
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
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cards: state.cards,
        attempts: state.attempts,
        ownerUserId: state.ownerUserId,
      }),
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

function removePendingCardId(set: (fn: (state: InventoryState) => InventoryState) => void, cardId: string) {
  set((state) => {
    const next = new Set(state.pendingCardIds);
    next.delete(cardId);
    return { ...state, pendingCardIds: next };
  });
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

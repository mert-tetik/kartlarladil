"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import { localCardRepository } from "@/features/cards/card-repository";
import { STORAGE_KEY } from "@/lib/constants";
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

interface RecordAnswerResult {
  attempt: PracticeAttempt;
  inventoryCard: InventoryCard;
}

interface InventoryState {
  cards: InventoryCard[];
  attempts: PracticeAttempt[];
  ownerUserId: string | null;
  hydrated: boolean;
  cloudEnabled: boolean;
  cloudLoading: boolean;
  cloudError: string;
  setHydrated: (hydrated: boolean) => void;
  setCloudEnabled: (enabled: boolean) => void;
  setOwnerUserId: (userId: string | null) => void;
  clearLocalInventory: () => void;
  loadCloudInventory: () => Promise<void>;
  migrateLocalInventoryToCloud: () => Promise<void>;
  addCard: (cardId: string) => Promise<void>;
  removeCard: (cardId: string) => Promise<void>;
  hasCard: (cardId: string) => boolean;
  recordAnswer: (input: {
    cardId: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    mode: PracticeMode;
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

      setHydrated(hydrated) {
        set({ hydrated });
      },

      setCloudEnabled(enabled) {
        set({ cloudEnabled: enabled, cloudError: enabled ? get().cloudError : "" });
      },

      setOwnerUserId(userId) {
        set({ ownerUserId: userId });
      },

      clearLocalInventory() {
        set({ cards: [], attempts: [], ownerUserId: null });
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
      },

      async addCard(cardId) {
        if (get().cloudEnabled) {
          set({ cloudLoading: true, cloudError: "" });
          const result = await addCloudInventoryCardAction(cardId);

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
          return;
        }

        set((state) => ({
          cards: addCardToInventory(state.cards, cardId),
        }));
      },

      async removeCard(cardId) {
        if (get().cloudEnabled) {
          set({ cloudLoading: true, cloudError: "" });
          const result = await removeCloudInventoryCardAction(cardId);

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
          return;
        }

        set((state) => ({
          cards: state.cards.filter((card) => card.cardId !== cardId),
          attempts: state.attempts.filter((attempt) => attempt.cardId !== cardId),
        }));
      },

      hasCard(cardId) {
        return get().cards.some((card) => card.cardId === cardId);
      },

      async recordAnswer(input) {
        if (get().cloudEnabled) {
          set({ cloudLoading: true, cloudError: "" });
          const result = await recordCloudPracticeAttemptAction(input);

          if (result.status === "error" || !result.data) {
            set({ cloudLoading: false, cloudError: result.message });
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

          return inventoryCard && attempt ? { inventoryCard, attempt } : undefined;
        }

        const vocabularyCard = localCardRepository.findById(input.cardId);
        const ownedCard = get().cards.find((card) => card.cardId === input.cardId);

        if (!vocabularyCard || !ownedCard) {
          return undefined;
        }

        const updatedCard =
          input.mode === "learned"
            ? ownedCard
            : applyAnswerProgress(ownedCard, vocabularyCard, input.isCorrect);
        const attempt = createPracticeAttempt(input);

        set((state) => ({
          cards: state.cards.map((card) => (card.cardId === input.cardId ? updatedCard : card)),
          attempts: [attempt, ...state.attempts].slice(0, 100),
        }));

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
          return;
        }

        customCardRegistry.clear();

        set({
          cards: [],
          attempts: [],
          ownerUserId: null,
        });
      },

      async createCustomCard(input) {
        set({ cloudLoading: true, cloudError: "" });

        const result = await createCustomCardAction(input);

        if (result.status === "error" || !result.data) {
          set({ cloudLoading: false, cloudError: result.message });
          throw new Error(result.message);
        }

        const customCardsResult = await loadCustomCardsAction();

        if (customCardsResult.status === "error" || !customCardsResult.data) {
          set({ cloudLoading: false, cloudError: customCardsResult.message });
          throw new Error(customCardsResult.message);
        }

        customCardRegistry.clear();
        for (const card of customCardsResult.data) {
          customCardRegistry.register(card);
        }

        set({
          cards: result.data.cards,
          attempts: result.data.attempts,
          cloudLoading: false,
          cloudError: "",
        });
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

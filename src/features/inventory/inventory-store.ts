"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { VOCABULARY_CARDS } from "@/data/cards";
import { STORAGE_KEY } from "@/lib/constants";
import type { InventoryCard, PracticeAttempt, PracticeMode } from "@/types/domain";
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
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  addCard: (cardId: string) => void;
  hasCard: (cardId: string) => boolean;
  recordAnswer: (input: {
    cardId: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    mode: PracticeMode;
  }) => RecordAnswerResult | undefined;
  reset: () => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      cards: [],
      attempts: [],
      hydrated: false,

      setHydrated(hydrated) {
        set({ hydrated });
      },

      addCard(cardId) {
        set((state) => ({
          cards: addCardToInventory(state.cards, cardId),
        }));
      },

      hasCard(cardId) {
        return get().cards.some((card) => card.cardId === cardId);
      },

      recordAnswer(input) {
        const vocabularyCard = VOCABULARY_CARDS.find((card) => card.id === input.cardId);
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

      reset() {
        set({
          cards: [],
          attempts: [],
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cards: state.cards,
        attempts: state.attempts,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

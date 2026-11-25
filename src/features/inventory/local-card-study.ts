"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PracticeMode } from "@/types/domain";
import {
  createLocalCardStudyRecord,
  sanitizeLocalCardStudyMap,
  type LocalCardStudyMap,
} from "@/features/inventory/local-card-study-scheduler";

export {
  getLearnedCardNextReviewAt,
  getLocalCardStudyRecord,
  isLearnedCardDue,
  LEARNED_REVIEW_INTERVALS_MS,
  sanitizeLocalCardStudyMap,
} from "@/features/inventory/local-card-study-scheduler";
export type { LocalCardStudyMap, LocalCardStudyRecord } from "@/features/inventory/local-card-study-scheduler";

export const LOCAL_CARD_STUDY_STORAGE_KEY = "foxiesdeck:local-card-study:v1";

interface LocalCardStudyState {
  cards: LocalCardStudyMap;
  learnedReviewIntroSeen: boolean;
  recordPractice: (
    cardId: string,
    mode: PracticeMode,
    isCorrect: boolean,
    options?: { now?: number; newlyLearned?: boolean },
  ) => void;
  markLearnedReviewIntroSeen: () => void;
  forgetCards: (cardIds: readonly string[]) => void;
  clearCardStudy: () => void;
}

export const useLocalCardStudyStore = create<LocalCardStudyState>()(
  persist(
    (set) => ({
      cards: {},
      learnedReviewIntroSeen: false,

      recordPractice(cardId, mode, isCorrect, options) {
        if (!cardId || cardId.length > 512) return;
        const now = options?.now ?? Date.now();
        if (!Number.isFinite(now)) return;

        set((state) => ({
          cards: {
            ...state.cards,
            [cardId]: createLocalCardStudyRecord(state.cards[cardId], {
              mode,
              isCorrect,
              now,
              newlyLearned: Boolean(options?.newlyLearned),
            }),
          },
        }));
      },

      markLearnedReviewIntroSeen() {
        set({ learnedReviewIntroSeen: true });
      },

      forgetCards(cardIds) {
        if (cardIds.length === 0) return;
        set((state) => {
          const cards = { ...state.cards };
          for (const cardId of cardIds) delete cards[cardId];
          return { cards };
        });
      },

      clearCardStudy() {
        set({ cards: {} });
      },
    }),
    {
      name: LOCAL_CARD_STUDY_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cards: state.cards,
        learnedReviewIntroSeen: state.learnedReviewIntroSeen,
      }),
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== "object") return currentState;
        const persisted = persistedState as Partial<LocalCardStudyState>;
        return {
          ...currentState,
          cards: sanitizeLocalCardStudyMap(persisted.cards),
          learnedReviewIntroSeen: persisted.learnedReviewIntroSeen === true,
        };
      },
    },
  ),
);

export function recordLocalCardPractice(
  cardId: string,
  mode: PracticeMode,
  isCorrect: boolean,
  options?: { now?: number; newlyLearned?: boolean },
) {
  useLocalCardStudyStore.getState().recordPractice(cardId, mode, isCorrect, options);
}

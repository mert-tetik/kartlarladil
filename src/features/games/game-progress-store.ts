"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LANGUAGES } from "@/data/languages";
import { readLandingCardLanguage } from "@/app/components/landing-card-language";
import type { LanguageCode } from "@/types/domain";
import type { GameName, GameProgress, GamesProgress } from "./game-types";
import { getPointsForLevel } from "./game-levels";

const STORAGE_KEY = "foxiesdeck:games:progress";

function getDefaultLanguage(): LanguageCode | "all" {
  const landing = readLandingCardLanguage();
  if (landing && LANGUAGES.some((language) => language.code === landing)) {
    return landing;
  }
  return "all";
}

function defaultProgress(): GameProgress {
  return {
    currentLevel: 1,
    bestLevel: 0,
    totalPoints: 0,
  };
}

interface GameProgressState {
  progress: GamesProgress;
  selectedLanguage: LanguageCode | "all";
  getProgress: (game: GameName) => GameProgress;
  startLevel: (game: GameName, level: number) => void;
  completeLevel: (game: GameName, level: number) => void;
  resetGame: (game: GameName) => void;
  setSelectedLanguage: (language: LanguageCode | "all") => void;
}

export const useGameProgressStore = create<GameProgressState>()(
  persist(
    (set, get) => ({
      progress: {
        memory: defaultProgress(),
        wordChallenge: defaultProgress(),
      },
      selectedLanguage: getDefaultLanguage(),
      getProgress(game) {
        return get().progress[game] ?? defaultProgress();
      },
      startLevel(game, level) {
        set((state) => ({
          progress: {
            ...state.progress,
            [game]: {
              ...(state.progress[game] ?? defaultProgress()),
              currentLevel: level,
            },
          },
        }));
      },
      completeLevel(game, level) {
        set((state) => {
          const current = state.progress[game] ?? defaultProgress();
          const nextLevel = Math.max(current.currentLevel, level + 1);
          const points = getPointsForLevel(level);
          return {
            progress: {
              ...state.progress,
              [game]: {
                currentLevel: nextLevel,
                bestLevel: Math.max(current.bestLevel, level),
                totalPoints: current.totalPoints + points,
              },
            },
          };
        });
      },
      resetGame(game) {
        set((state) => ({
          progress: {
            ...state.progress,
            [game]: defaultProgress(),
          },
        }));
      },
      setSelectedLanguage(language) {
        set({ selectedLanguage: language });
      },
    }),
    {
      name: STORAGE_KEY,
    },
  ),
);

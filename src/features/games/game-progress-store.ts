"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameName, GameProgress, GamesProgress } from "./game-types";
import type { LanguageCode } from "@/types/domain";
import { getPointsForLevel } from "./game-levels";
import { syncMissionsFromClientState } from "@/features/missions/mission-sync";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";

const STORAGE_KEY = "foxiesdeck:games:progress";

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
  addPoints: (game: GameName, points: number) => void;
  resetGame: (game: GameName) => void;
  setSelectedLanguage: (language: LanguageCode | "all") => void;
}

export const useGameProgressStore = create<GameProgressState>()(
  persist(
    (set, get) => ({
      progress: {
        memory: defaultProgress(),
        wordChallenge: defaultProgress(),
        wordMatch: defaultProgress(),
      },
      selectedLanguage: "all",
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
        let didAdvance = false;
        let nextLevel = level + 1;
        let nextBestLevel = level;
        let nextTotalPoints = 0;

        set((state) => {
          const current = state.progress[game] ?? defaultProgress();
          nextLevel = Math.max(current.currentLevel, level + 1);
          nextBestLevel = Math.max(current.bestLevel, level);
          nextTotalPoints = current.totalPoints + getPointsForLevel(level);
          didAdvance = level > current.bestLevel;
          return {
            progress: {
              ...state.progress,
              [game]: {
                currentLevel: nextLevel,
                bestLevel: nextBestLevel,
                totalPoints: nextTotalPoints,
              },
            },
          };
        });

        if (didAdvance) {
          sendTwaAnalyticsEvent("fd_game_level_up", {
            params: {
              game_name: game,
              level,
              next_level: nextLevel,
              best_level: nextBestLevel,
              game_points: nextTotalPoints,
            },
          });
        }

        void syncMissionsFromClientState();
      },
      addPoints(game, points) {
        set((state) => {
          const current = state.progress[game] ?? defaultProgress();
          return {
            progress: {
              ...state.progress,
              [game]: {
                ...current,
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

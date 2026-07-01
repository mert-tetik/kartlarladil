"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameName, GameProgress, GamesProgress } from "./game-types";
import { getPointsForLevel } from "./game-levels";

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
  getProgress: (game: GameName) => GameProgress;
  startLevel: (game: GameName, level: number) => void;
  completeLevel: (game: GameName, level: number) => void;
  resetGame: (game: GameName) => void;
}

export const useGameProgressStore = create<GameProgressState>()(
  persist(
    (set, get) => ({
      progress: {
        memory: defaultProgress(),
        wordChallenge: defaultProgress(),
      },
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
    }),
    {
      name: STORAGE_KEY,
    },
  ),
);

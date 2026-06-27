"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TutorialState {
  completed: boolean;
  step: number;
  testMode: boolean;
  advance: () => void;
  complete: () => void;
  reset: () => void;
  enableTestMode: () => void;
  disableTestMode: () => void;
}

const TOTAL_STEPS = 7;

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set) => ({
      completed: false,
      step: 0,
      testMode: false,
      advance: () => {
        set((state) => {
          const nextStep = state.step + 1;
          return { step: nextStep, completed: nextStep >= TOTAL_STEPS };
        });
      },
      complete: () => set({ completed: true }),
      reset: () => set({ completed: false, step: 0 }),
      enableTestMode: () => set({ testMode: true }),
      disableTestMode: () => set({ testMode: false }),
    }),
    {
      name: "foxiesdeck:tutorial",
    },
  ),
);

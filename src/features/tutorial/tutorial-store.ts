"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TutorialState {
  completed: boolean;
  step: number;
  advance: () => void;
  complete: () => void;
  reset: () => void;
}

const TOTAL_STEPS = 7;

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set) => ({
      completed: false,
      step: 0,
      advance: () => {
        set((state) => {
          const nextStep = state.step + 1;
          return { step: nextStep, completed: nextStep >= TOTAL_STEPS };
        });
      },
      complete: () => set({ completed: true }),
      reset: () => set({ completed: false, step: 0 }),
    }),
    {
      name: "foxiesdeck:tutorial",
    },
  ),
);

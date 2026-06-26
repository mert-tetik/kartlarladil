"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TutorialState {
  completed: boolean;
  step: number;
  advance: () => void;
  reset: () => void;
}

const TOTAL_STEPS = 7;

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      completed: false,
      step: 0,
      advance: () => {
        const nextStep = get().step + 1;
        set({ step: nextStep, completed: nextStep >= TOTAL_STEPS });
      },
      reset: () => set({ completed: false, step: 0 }),
    }),
    {
      name: "foxiesdeck:tutorial",
    },
  ),
);

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TutorialState {
  active: boolean;
  completed: boolean;
  step: number;
  testMode: boolean;
  advance: () => void;
  complete: () => void;
  reset: () => void;
  activate: () => void;
  deactivate: () => void;
  enableTestMode: () => void;
  disableTestMode: () => void;
}

const TOTAL_STEPS = 9;

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set) => ({
      active: false,
      completed: false,
      step: 0,
      testMode: false,
      advance: () => {
        set((state) => {
          const nextStep = state.step + 1;
          return {
            step: nextStep,
            completed: nextStep >= TOTAL_STEPS,
            active: nextStep >= TOTAL_STEPS ? false : state.active,
          };
        });
      },
      complete: () => set({ active: false, completed: true }),
      reset: () => set({ active: false, completed: false, step: 0 }),
      activate: () => set({ active: true }),
      deactivate: () => set({ active: false }),
      enableTestMode: () => set({ testMode: true }),
      disableTestMode: () => set({ testMode: false }),
    }),
    {
      name: "foxiesdeck:tutorial",
      partialize: (state) => ({
        completed: state.completed,
        step: state.step,
        testMode: state.testMode,
      }),
      onRehydrateStorage: () => (state) => {
        if (typeof window === "undefined") return;

        const params = new URLSearchParams(window.location.search);
        const isTestUrl = params.get("tutorial-test") === "1" || params.get("tutorial-debug") === "1";
        if (isTestUrl && state) {
          useTutorialStore.setState({ completed: false, step: 0, testMode: true });
        }
      },
    },
  ),
);

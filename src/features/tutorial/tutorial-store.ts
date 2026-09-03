"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TutorialState {
  active: boolean;
  completed: boolean;
  introSeen: boolean;
  step: number;
  testMode: boolean;
  begin: () => void;
  advance: () => void;
  complete: () => void;
  reset: () => void;
  activate: () => void;
  deactivate: () => void;
  enableTestMode: () => void;
  disableTestMode: () => void;
}

export const TUTORIAL_STEP_COUNT = 4;

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set) => ({
      active: false,
      completed: false,
      introSeen: false,
      step: 0,
      testMode: false,
      begin: () => set({ introSeen: true }),
      advance: () => {
        set((state) => {
          const nextStep = state.step + 1;
          return {
            step: nextStep,
            completed: nextStep >= TUTORIAL_STEP_COUNT,
            active: nextStep >= TUTORIAL_STEP_COUNT ? false : state.active,
          };
        });
      },
      complete: () => set({ active: false, completed: true }),
      reset: () => set({ active: false, completed: false, introSeen: false, step: 0 }),
      activate: () => set({ active: true }),
      deactivate: () => set({ active: false }),
      enableTestMode: () => set({ testMode: true }),
      disableTestMode: () => set({ testMode: false }),
    }),
    {
      name: "foxiesdeck:tutorial",
      version: 2,
      partialize: (state) => ({
        // Keep an unfinished onboarding tutorial alive across an app restart.
        active: state.active,
        completed: state.completed,
        introSeen: state.introSeen,
        step: state.step,
      }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<TutorialState> | undefined;

        // The old tutorial had nine unrelated targets. An unfinished old
        // flow must restart at the new welcome/choice flow; a completed one
        // must stay completed for existing users.
        if (state?.completed) {
          return {
            active: false,
            completed: true,
            introSeen: true,
            step: TUTORIAL_STEP_COUNT,
            testMode: false,
          };
        }

        return {
          active: Boolean(state?.active),
          completed: false,
          introSeen: false,
          step: 0,
          testMode: false,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (typeof window === "undefined") return;

        const params = new URLSearchParams(window.location.search);
        const isTestUrl = params.get("tutorial-test") === "1" || params.get("tutorial-debug") === "1";
        if (isTestUrl && state) {
          useTutorialStore.setState({ completed: false, introSeen: false, step: 0, testMode: true });
        }
      },
    },
  ),
);

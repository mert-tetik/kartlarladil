export type TutorialMode = "choice" | "target" | "message";

export interface TutorialStep {
  step: number;
  key: string;
  mode: TutorialMode;
  selector?: string;
  messageKey?: string;
}

export interface TutorialTarget extends TutorialStep {
  selector: string;
}

export const TUTORIAL_FLOW: readonly TutorialStep[] = [
  {
    step: 0,
    key: "card-modes",
    mode: "choice",
  },
  {
    step: 1,
    key: "landing-card-center",
    mode: "target",
    selector: '[data-tutorial-target="landing-card-center"]',
    messageKey: "tutorial.landingCardsAction",
  },
  {
    step: 2,
    key: "card-collection-message",
    mode: "message",
    messageKey: "tutorial.landingCardsMessage",
  },
  {
    step: 3,
    key: "start-learning",
    mode: "target",
    selector: '[data-tutorial-target="start-learning"]',
    messageKey: "tutorial.landingStartLearningAction",
  },
];

export const TUTORIAL_TARGETS: readonly TutorialTarget[] = TUTORIAL_FLOW.filter(
  (item): item is TutorialTarget => item.mode === "target" && typeof item.selector === "string",
);

export function getTutorialStep(step: number): TutorialStep | null {
  return TUTORIAL_FLOW.find((item) => item.step === step) ?? null;
}

export function getTargetForStep(step: number, pathname: string): TutorialTarget | null {
  if (pathname !== "/") return null;

  const item = getTutorialStep(step);
  return item?.mode === "target" && item.selector ? item as TutorialTarget : null;
}

export function isTargetPage(pathname: string): boolean {
  return pathname === "/";
}

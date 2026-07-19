export interface TutorialTarget {
  step: number;
  key: string;
  selector: string;
}

export const TUTORIAL_TARGETS: readonly TutorialTarget[] = [
  {
    step: 0,
    key: "landing-draw-cards",
    selector: '[data-tutorial-target="landing-draw-cards"]',
  },
  {
    step: 1,
    key: "landing-create-card",
    selector: '[data-tutorial-target="landing-create-card"]',
  },
  {
    step: 2,
    key: "landing-card-center",
    selector: '[data-tutorial-target="landing-card-center"]',
  },
  {
    step: 3,
    key: "start-learning",
    selector: '[data-tutorial-target="start-learning"]',
  },
  {
    step: 4,
    key: "repeat-learned",
    selector: '[data-tutorial-target="repeat-learned"]',
  },
  {
    step: 5,
    key: "rank-info",
    selector: '[data-tutorial-target="rank-info"]',
  },
  {
    step: 6,
    key: "leaderboard",
    selector: '[data-tutorial-target="leaderboard"]',
  },
  {
    step: 7,
    key: "games-nav",
    selector: '[data-tutorial-target="games-nav"]',
  },
  {
    step: 8,
    key: "ai-practice-nav",
    selector: '[data-tutorial-target="ai-practice-nav"]',
  },
];

export function getTargetForStep(step: number, pathname: string): TutorialTarget | null {
  if (step < 0) return null;

  if (pathname !== "/") return null;

  const target = TUTORIAL_TARGETS.find((item) => item.step === step);
  return target ?? null;
}

export function isTargetPage(pathname: string): boolean {
  return pathname === "/";
}

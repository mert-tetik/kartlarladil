export interface TutorialTarget {
  step: number;
  key: string;
  selector: string;
  pages: string[];
  advanceOnClick?: boolean;
  pointerOffsetY?: number;
}

export const TUTORIAL_TARGETS: readonly TutorialTarget[] = [
  {
    step: 0,
    key: "landing-draw-cards",
    selector: '[data-tutorial-target="landing-draw-cards"]',
    pages: ["/"],
    advanceOnClick: false,
  },
  {
    step: 1,
    key: "tier-choice",
    selector: '[data-tutorial-target="tier-choice"]',
    pages: ["/"],
    advanceOnClick: false,
  },
  {
    step: 2,
    key: "draw-cards-action",
    selector: '[data-tutorial-target="draw-cards-action"]',
    pages: ["/card-draw"],
  },
  {
    step: 3,
    key: "draw-card-result",
    selector: '[data-tutorial-target="draw-card-result"]',
    pages: ["/card-draw"],
  },
  {
    step: 4,
    key: "card-add",
    selector: '[data-tutorial-target="card-add"]',
    pages: ["/card-draw"],
    advanceOnClick: false,
  },
  {
    step: 5,
    key: "card-draw-navbar-back",
    selector: '[data-tutorial-target="card-draw-navbar-back"]',
    pages: ["/card-draw"],
    pointerOffsetY: 12,
  },
  {
    step: 6,
    key: "landing-learning-cards",
    selector: '[data-tutorial-target="landing-learning-cards"]',
    pages: ["/"],
  },
  {
    step: 7,
    key: "close-collection-menu",
    selector: '[data-tutorial-target="close-collection-menu"]',
    pages: ["/"],
    pointerOffsetY: 12,
  },
  {
    step: 8,
    key: "create-card",
    selector: '[data-tutorial-target="create-card"]',
    pages: ["/"],
  },
  {
    step: 9,
    key: "create-card-navbar-back",
    selector: '[data-tutorial-target="create-card-navbar-back"]',
    pages: ["/create-card"],
    pointerOffsetY: 12,
  },
  {
    step: 10,
    key: "rank-info",
    selector: '[data-tutorial-target="rank-info"]',
    pages: ["/"],
  },
  {
    step: 11,
    key: "close-rank-menu",
    selector: '[data-tutorial-target="close-rank-menu"]',
    pages: ["/"],
    pointerOffsetY: 12,
  },
  {
    step: 12,
    key: "leaderboard",
    selector: '[data-tutorial-target="leaderboard"]',
    pages: ["/"],
  },
  {
    step: 13,
    key: "leaderboard-navbar-back",
    selector: '[data-tutorial-target="leaderboard-navbar-back"]',
    pages: ["/leaderboard"],
    pointerOffsetY: 12,
  },
  {
    step: 14,
    key: "start-learning",
    selector: '[data-tutorial-target="start-learning"]',
    pages: ["/"],
  },
];

export function getTargetForStep(step: number, pathname: string): TutorialTarget | null {
  if (step < 0) return null;

  const target = TUTORIAL_TARGETS.find((item) => item.step === step);
  if (!target) return null;

  if (!target.pages.some((page) => pathname === page || pathname.startsWith(`${page}/`))) {
    return null;
  }

  return target;
}

export function isTargetPage(pathname: string): boolean {
  return TUTORIAL_TARGETS.some((target) =>
    target.pages.some((page) => pathname === page || pathname.startsWith(`${page}/`)),
  );
}

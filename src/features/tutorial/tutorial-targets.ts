export interface TutorialTarget {
  step: number;
  key: string;
  selector: string;
  pages: string[];
  advanceOnClick?: boolean;
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
    key: "navbar-back",
    selector: '[data-tutorial-target="navbar-back"]',
    pages: ["/card-draw"],
  },
  {
    step: 6,
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

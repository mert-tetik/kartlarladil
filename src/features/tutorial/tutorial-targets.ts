export interface TutorialTarget {
  step: number;
  key: string;
  selector: string;
  pages: string[];
}

export const TUTORIAL_TARGETS: readonly TutorialTarget[] = [
  {
    step: 0,
    key: "landing-draw-cards",
    selector: '[data-tutorial-target="landing-draw-cards"]',
    pages: ["/"],
  },
  {
    step: 1,
    key: "tier-filter",
    selector: '[data-tutorial-target="tier-filter"]',
    pages: ["/card-draw"],
  },
  {
    step: 2,
    key: "draw-cards-action",
    selector: '[data-tutorial-target="draw-cards-action"]',
    pages: ["/card-draw"],
  },
  {
    step: 3,
    key: "navbar-back",
    selector: '[data-tutorial-target="navbar-back"]',
    pages: ["/card-draw", "/learn", "/learned", "/ai-practice"],
  },
  {
    step: 4,
    key: "start-learning",
    selector: '[data-tutorial-target="start-learning"]',
    pages: ["/"],
  },
];

export function getTargetForStep(step: number, pathname: string): TutorialTarget | null {
  if (step < 0) return null;

  for (let candidateStep = step; candidateStep >= 0; candidateStep -= 1) {
    const target = TUTORIAL_TARGETS.find((item) => item.step === candidateStep);
    if (target && target.pages.some((page) => pathname === page || pathname.startsWith(`${page}/`))) {
      return target;
    }
  }

  return null;
}

export function isTargetPage(pathname: string): boolean {
  return TUTORIAL_TARGETS.some((target) =>
    target.pages.some((page) => pathname === page || pathname.startsWith(`${page}/`)),
  );
}

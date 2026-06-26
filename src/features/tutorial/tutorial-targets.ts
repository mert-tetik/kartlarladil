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
    key: "tier-choice",
    selector: '[data-tutorial-target="tier-choice"], [data-tutorial-target="tier-filter"]',
    pages: ["/", "/card-draw"],
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

import { runQuizEndActionAfterSingleTap } from "@/features/quiz/quiz-end-action-tap-guard";

export function runMissionCardActionAfterSingleTap(
  screen: HTMLElement,
  action: () => void,
  tapWindowMs: number,
) {
  runQuizEndActionAfterSingleTap(
    screen,
    action,
    tapWindowMs,
    () => screen.dataset.missionTapGuardActive === "true",
  );
}

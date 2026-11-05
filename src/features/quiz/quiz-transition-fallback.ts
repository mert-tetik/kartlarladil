export function prepareTierFlashTransitionSnapshot(
  source: HTMLElement,
  snapshot: HTMLElement,
  durationMs: number,
) {
  if (!source.classList.contains("animate-quiz-tier-background-flash")) return;

  // The tier-flash class has a later animation rule than the fallback layer.
  // Freeze its current background and explicitly animate the snapshot left so
  // the previous card-progress/learned screen cannot override the transition.
  snapshot.style.setProperty(
    "background-color",
    window.getComputedStyle(source).backgroundColor,
    "important",
  );
  snapshot.style.setProperty(
    "animation",
    `quiz-transition-fallback-exit-left ${durationMs}ms cubic-bezier(0.85, 0, 0.15, 1) both`,
    "important",
  );
}

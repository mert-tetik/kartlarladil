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

export function preserveStreakRewardHudInTransitionSnapshot(
  source: HTMLElement,
  snapshot: HTMLElement,
) {
  const sourceHuds = Array.from(
    source.querySelectorAll<HTMLElement>("[data-streak-reward-points]"),
  );
  const snapshotHuds = Array.from(
    snapshot.querySelectorAll<HTMLElement>("[data-streak-reward-points]"),
  );

  sourceHuds.forEach((sourceHud, index) => {
    const snapshotHud = snapshotHuds[index];
    if (!snapshotHud) return;

    const computedStyle = window.getComputedStyle(sourceHud);
    if (computedStyle.opacity === "0" || computedStyle.visibility === "hidden") {
      snapshotHud.remove();
      return;
    }

    snapshotHud.classList.remove(
      "animate-streak-reward-hud-enter",
      "animate-streak-reward-hud-exit",
    );
    snapshotHud.style.setProperty("animation", "none", "important");
    snapshotHud.style.setProperty("opacity", computedStyle.opacity || "1", "important");
    snapshotHud.style.setProperty("transform", computedStyle.transform || "none", "important");
    snapshotHud.style.setProperty("visibility", computedStyle.visibility || "visible", "important");
  });
}

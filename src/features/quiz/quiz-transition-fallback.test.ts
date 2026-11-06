import {
  prepareTierFlashTransitionSnapshot,
  preserveStreakRewardHudInTransitionSnapshot,
} from "@/features/quiz/quiz-transition-fallback";

describe("prepareTierFlashTransitionSnapshot", () => {
  it("keeps the current tier color while forcing the previous screen to slide left", () => {
    const source = document.createElement("div");
    source.classList.add("animate-quiz-tier-background-flash");
    source.style.backgroundColor = "rgb(255, 165, 0)";
    const snapshot = document.createElement("div");

    prepareTierFlashTransitionSnapshot(source, snapshot, 360);

    expect(snapshot.style.getPropertyValue("background-color")).toBe("rgb(255, 165, 0)");
    expect(snapshot.style.getPropertyPriority("background-color")).toBe("important");
    expect(snapshot.style.animation).toBe(
      "quiz-transition-fallback-exit-left 360ms cubic-bezier(0.85, 0, 0.15, 1) both",
    );
    expect(snapshot.style.getPropertyPriority("animation")).toBe("important");
  });

  it("leaves screens without a tier flash unchanged", () => {
    const source = document.createElement("div");
    const snapshot = document.createElement("div");

    prepareTierFlashTransitionSnapshot(source, snapshot, 360);

    expect(snapshot.getAttribute("style")).toBeNull();
  });
});

describe("preserveStreakRewardHudInTransitionSnapshot", () => {
  it("does not resurrect a streak reward HUD that has already disappeared", () => {
    const source = document.createElement("div");
    source.innerHTML = `
      <div data-streak-reward-points class="animate-streak-reward-hud-exit" style="opacity: 0; transform: scale(0.72)"></div>
    `;
    const snapshot = source.cloneNode(true) as HTMLElement;

    preserveStreakRewardHudInTransitionSnapshot(source, snapshot);

    expect(source.querySelector("[data-streak-reward-points]")).not.toBeNull();
    expect(snapshot.querySelector("[data-streak-reward-points]")).not.toBeInTheDocument();
  });

  it("freezes a visible streak reward HUD for the outgoing screen transition", () => {
    const source = document.createElement("div");
    source.innerHTML = `
      <div data-streak-reward-points class="animate-streak-reward-hud-exit" style="opacity: 0.42; transform: scale(0.86)"></div>
    `;
    const sourceHud = source.querySelector<HTMLElement>("[data-streak-reward-points]")!;
    const snapshot = source.cloneNode(true) as HTMLElement;

    preserveStreakRewardHudInTransitionSnapshot(source, snapshot);

    const snapshotHud = snapshot.querySelector<HTMLElement>("[data-streak-reward-points]")!;
    expect(snapshotHud).not.toHaveClass("animate-streak-reward-hud-exit");
    expect(snapshotHud.style.getPropertyValue("animation")).toBe("none");
    expect(snapshotHud.style.getPropertyPriority("animation")).toBe("important");
    expect(snapshotHud.style.getPropertyValue("opacity")).toBe(
      window.getComputedStyle(sourceHud).opacity,
    );
    expect(snapshotHud.style.getPropertyValue("transform")).toBe(
      window.getComputedStyle(sourceHud).transform,
    );
  });
});

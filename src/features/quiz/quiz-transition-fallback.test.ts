import { prepareTierFlashTransitionSnapshot } from "@/features/quiz/quiz-transition-fallback";

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

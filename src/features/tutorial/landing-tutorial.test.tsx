import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingTutorial } from "@/features/tutorial/landing-tutorial";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";

vi.mock("@/i18n/locale-provider", () => ({
  useT: () => (key: string) => key,
}));

const TARGETS = [
  "landing-draw-cards",
  "landing-create-card",
  "landing-card-center",
  "start-learning",
  "repeat-learned",
  "rank-info",
  "leaderboard",
  "games-nav",
] as const;

describe("LandingTutorial", () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: function getBoundingClientRect(this: HTMLElement) {
        const target = this.getAttribute("data-tutorial-target");
        const lowerTarget = target === "games-nav" || target === "landing-card-center";
        const top = lowerTarget ? 680 : 80;

        return {
          x: 32,
          y: top,
          top,
          left: 32,
          bottom: top + 48,
          right: 358,
          width: 326,
          height: 48,
          toJSON: () => ({}),
        } as DOMRect;
      },
    });
    useTutorialStore.setState({ active: true, completed: false, step: 0, testMode: false });
  });

  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: originalRect,
    });
    useTutorialStore.setState({ active: false, completed: false, step: 0, testMode: false });
  });

  function renderTutorial() {
    return render(
      <>
        {TARGETS.map((target) => <button key={target} type="button" data-tutorial-target={target}>{target}</button>)}
        <LandingTutorial />
      </>,
    );
  }

  it("shows a blocked circular spotlight and advances only from the next button", async () => {
    renderTutorial();

    const dialog = await screen.findByRole("dialog");
    const message = document.querySelector("[data-landing-tutorial-message]") as HTMLElement;
    const nextButton = screen.getByRole("button", { name: "tutorial.next" });

    expect(message).toHaveTextContent("tutorial.landingDrawRandom");
    expect(document.querySelector("[data-landing-tutorial-spotlight]")).toHaveClass("rounded-full", "border-red-500");
    expect(Number.parseFloat(nextButton.style.top)).toBeCloseTo(Number.parseFloat(message.style.top) + 96);

    fireEvent.click(dialog);
    expect(useTutorialStore.getState().step).toBe(0);

    fireEvent.click(nextButton);
    await waitFor(() => expect(useTutorialStore.getState().step).toBe(1));
    expect(document.querySelector("[data-landing-tutorial-message]")).toHaveTextContent("tutorial.landingCreateCustom");
  });

  it("uses rectangular spotlights for the card center and learning actions", async () => {
    renderTutorial();

    for (const step of [2, 3, 4]) {
      act(() => {
        useTutorialStore.setState({ active: true, completed: false, step, testMode: false });
      });

      await waitFor(() => {
        const spotlight = document.querySelector("[data-landing-tutorial-spotlight]");
        expect(spotlight).toHaveAttribute("data-spotlight-shape", "rectangle");
        expect(spotlight).toHaveClass("rounded-lg", "border-red-500");
      });
    }

    expect(document.querySelectorAll("[data-landing-tutorial-rect-mask]")).toHaveLength(4);
  });

  it("uses the required color sequence and finishes with the understood action", async () => {
    renderTutorial();

    const nextButton = await screen.findByRole("button", { name: "tutorial.next" });
    expect(nextButton).toHaveClass("bg-emerald-500");
    expect(document.querySelector("[data-landing-tutorial-message]")).toHaveClass("bg-emerald-500");

    useTutorialStore.setState({ active: true, completed: false, step: 1, testMode: false });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "tutorial.next" })).toHaveClass("bg-blue-500");
      expect(document.querySelector("[data-landing-tutorial-message]")).toHaveClass("bg-blue-500");
    });

    useTutorialStore.setState({ active: true, completed: false, step: 7, testMode: false });
    const lastButton = await screen.findByRole("button", { name: "tutorial.understood" });
    expect(lastButton).toHaveClass("bg-amber-400");

    fireEvent.click(lastButton);
    await waitFor(() => expect(useTutorialStore.getState().completed).toBe(true));
  });

  it("does not render on desktop widths", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    renderTutorial();

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

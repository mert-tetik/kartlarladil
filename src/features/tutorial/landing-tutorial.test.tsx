import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingTutorial } from "@/features/tutorial/landing-tutorial";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";

vi.mock("@/i18n/locale-provider", () => ({
  useT: () => (key: string) => key,
}));

function TutorialFixture() {
  const [layer, setLayer] = useState<string | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [started, setStarted] = useState(false);

  return (
    <>
      <section data-mobile-landing-dashboard>
        <button type="button" data-tutorial-target="landing-draw-cards" onClick={() => setLayer("draw-cards")}>draw</button>
        <button type="button" data-tutorial-target="landing-create-card" onClick={() => setLayer("custom-card")}>custom</button>
        <button type="button" data-tutorial-target="landing-card-groups" onClick={() => setLayer("card-groups")}>groups</button>
        <button type="button" data-tutorial-target="landing-card-center" onClick={() => setCardsOpen(true)}>cards</button>
        <button type="button" data-tutorial-target="start-learning" onClick={() => setStarted(true)}>start</button>
        {cardsOpen ? <div id="mobile-card-center-content">card collection</div> : null}
      </section>
      {layer ? <div data-tutorial-layer={layer} aria-hidden="false"><button type="button" onClick={() => setLayer(null)}>close layer</button></div> : null}
      {started ? <p>started</p> : null}
      <LandingTutorial />
    </>
  );
}

describe("LandingTutorial", () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: function getBoundingClientRect(this: HTMLElement) {
        const target = this.getAttribute("data-tutorial-target");
        const top = target === "landing-card-center" || target === "start-learning" ? 680 : 120;
        return { x: 32, y: top, top, left: 32, bottom: top + 48, right: 358, width: 326, height: 48, toJSON: () => ({}) } as DOMRect;
      },
    });
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 0, testMode: false });
  });

  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", { configurable: true, value: originalRect });
    useTutorialStore.setState({ active: false, completed: false, introSeen: false, step: 0, testMode: false });
  });

  it("shows the new welcome explanation before the choice screen", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: false, step: 0, testMode: false });
    render(<TutorialFixture />);

    expect(await screen.findByRole("status", { name: "Starting tutorial" })).toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "tutorial.welcome" })).toBeInTheDocument();
  });

  it("renders exactly three card mode choices and blocks the landing below them", async () => {
    render(<TutorialFixture />);
    expect(await screen.findByRole("dialog", { name: "tutorial.cardModes.title" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-landing-tutorial-choice]")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "cards" }));
    expect(document.querySelector("#mobile-card-center-content")).not.toBeInTheDocument();
  });

  it("opens the selected real layer and continues one second after it closes", async () => {
    render(<TutorialFixture />);
    const choice = await screen.findByRole("button", { name: /tutorial\.cardModes\.random\.title/ });
    fireEvent.click(choice);
    expect(await screen.findByText("close layer")).toBeInTheDocument();
    expect(document.querySelector("[data-landing-tutorial-choice-screen]")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close layer" }));
    await waitFor(() => expect(useTutorialStore.getState().step).toBe(1), { timeout: 2_000 });
    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_000 });
  });

  it("keeps the cards target restricted and then shows a message-only screen", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 1, testMode: false });
    render(<TutorialFixture />);
    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });

    fireEvent.click(screen.getByRole("button", { name: "cards" }));
    await waitFor(() => expect(useTutorialStore.getState().step).toBe(2), { timeout: 2_500 });
    expect(document.querySelector("[data-landing-tutorial-spotlight]")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "tutorial.next" })).toBeInTheDocument();
    expect(document.querySelector("#mobile-card-center-content")).toBeInTheDocument();
  });

  it("scrolls at 400ms and reaches the learning target after message continue", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 2, testMode: false });
    render(<TutorialFixture />);
    const dashboard = document.querySelector("[data-mobile-landing-dashboard]") as HTMLElement;
    dashboard.scrollTo = vi.fn();
    const continueButton = await screen.findByRole("button", { name: "tutorial.next" });
    fireEvent.click(continueButton);
    await waitFor(() => expect(dashboard.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" }), { timeout: 800 });
    await waitFor(() => expect(useTutorialStore.getState().step).toBe(3), { timeout: 1_500 });
    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_000 });
  });

  it("completes when the real start-learning target is clicked", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 3, testMode: false });
    render(<TutorialFixture />);
    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(useTutorialStore.getState().completed).toBe(true), { timeout: 1_000 });
    expect(screen.getByText("started")).toBeInTheDocument();
  });
});

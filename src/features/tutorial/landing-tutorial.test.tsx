import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingTutorial } from "@/features/tutorial/landing-tutorial";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { TUTORIAL_CARD_LAYER_REQUESTED_EVENT } from "@/features/tutorial/tutorial-card-session";

vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "en" }),
  useT: () => (key: string) => key,
}));

function TutorialFixture() {
  const [layer, setLayer] = useState<string | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [nestedInteraction, setNestedInteraction] = useState(false);

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
      {layer ? <div data-tutorial-layer-portal={layer}><button type="button" onClick={() => setNestedInteraction(true)}>nested layer action</button></div> : null}
      {started ? <p>started</p> : null}
      {nestedInteraction ? <p>nested interaction</p> : null}
      <LandingTutorial />
    </>
  );
}

function NavigatingTutorialFixture() {
  const [navigated, setNavigated] = useState(false);

  if (navigated) {
    return <p data-testid="learn-route">learn route</p>;
  }

  return (
    <>
      <section data-mobile-landing-dashboard>
        <button type="button" data-tutorial-target="start-learning" onClick={() => setNavigated(true)}>
          start
        </button>
      </section>
      <LandingTutorial />
    </>
  );
}

function EventDrivenLayerTutorialFixture() {
  const [layer, setLayer] = useState<string | null>(null);

  useEffect(() => {
    function handleLayerRequested(event: Event) {
      const detail = (event as CustomEvent<{ layer?: string }>).detail;
      if (detail?.layer) setLayer(detail.layer);
    }

    window.addEventListener(TUTORIAL_CARD_LAYER_REQUESTED_EVENT, handleLayerRequested);
    return () => window.removeEventListener(TUTORIAL_CARD_LAYER_REQUESTED_EVENT, handleLayerRequested);
  }, []);

  return (
    <>
      <section data-mobile-landing-dashboard>
        <button type="button" data-tutorial-target="landing-draw-cards">draw</button>
      </section>
      {layer ? <div data-tutorial-layer={layer} aria-hidden="false"><button type="button">close layer</button></div> : null}
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
    expect(await screen.findByText("close layer", {}, { timeout: 3_500 })).toBeInTheDocument();
    expect(document.querySelector("[data-landing-tutorial-choice-screen]")).not.toBeInTheDocument();
    expect(await screen.findByTestId("tutorial-layer-message", {}, { timeout: 2_000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("tutorial-layer-message")).not.toBeInTheDocument(), { timeout: 4_000 });

    fireEvent.click(screen.getByRole("button", { name: "close layer" }));
    await waitFor(() => expect(useTutorialStore.getState().step).toBe(1), { timeout: 2_500 });
    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });
  });

  it("opens a layer through the direct tutorial request when the target click is guarded", async () => {
    render(<EventDrivenLayerTutorialFixture />);

    const choice = await screen.findByRole("button", { name: /tutorial\.cardModes\.random\.title/ });
    fireEvent.click(choice);

    expect(await screen.findByText("close layer", {}, { timeout: 3_500 })).toBeInTheDocument();
    expect(await screen.findByTestId("tutorial-layer-message", {}, { timeout: 2_000 })).toBeInTheDocument();
  });

  it("allows interactions from a portal belonging to the active tutorial layer", async () => {
    render(<TutorialFixture />);

    const choice = await screen.findByRole("button", { name: /tutorial\.cardModes\.random\.title/ });
    fireEvent.click(choice);
    expect(await screen.findByRole("button", { name: "close layer" }, { timeout: 3_500 })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("tutorial-layer-message")).not.toBeInTheDocument(), { timeout: 4_000 });

    fireEvent.click(screen.getByRole("button", { name: "nested layer action" }));
    expect(screen.getByText("nested interaction")).toBeInTheDocument();
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

  it.each([
    { direction: 1, step: 1, viewportHeight: 844 },
    { direction: -1, step: 3, viewportHeight: 1600 },
  ])("shrinks the tutorial arrow while preserving its actual tip position (direction $direction)", async ({ direction, step, viewportHeight }) => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: viewportHeight });
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step, testMode: false });
    render(<TutorialFixture />);

    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });

    const arrow = document.querySelector<SVGPathElement>(".tutorial-arrow-path");
    const marker = document.querySelector<SVGMarkerElement>("#landing-tutorial-arrowhead");
    expect(arrow).toBeInTheDocument();
    expect(arrow).toHaveAttribute("stroke-width", "5");
    expect(marker).toHaveAttribute("markerWidth", "14");
    expect(marker).toHaveAttribute("markerHeight", "14");
    expect(marker).toHaveAttribute("refX", "14");
    expect(marker).toHaveAttribute("refY", "7");
    expect(marker).toHaveAttribute("viewBox", "0 0 14 14");
    expect(marker).toHaveAttribute("data-tutorial-arrow-tip-anchor", "path-end");

    const originalAnchorY = Number(arrow?.getAttribute("data-tutorial-arrow-anchor-y"));
    const preservedTipOffset = Number(arrow?.getAttribute("data-tutorial-arrow-tip-offset"));
    const actualTipY = Number(arrow?.getAttribute("data-tutorial-arrow-tip-y"));
    const pathEndY = Number(arrow?.getAttribute("d")?.trim().split(/\s/u).at(-1));

    expect(preservedTipOffset).toBe(direction * 22);
    expect(actualTipY).toBe(originalAnchorY + preservedTipOffset);
    expect(pathEndY).toBe(actualTipY);
  });

  it("scrolls at 400ms and reaches the learning target after message continue", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 2, testMode: false });
    render(<TutorialFixture />);
    const dashboard = document.querySelector("[data-mobile-landing-dashboard]") as HTMLElement;
    dashboard.scrollTo = vi.fn();
    const continueButton = await screen.findByRole("button", { name: "tutorial.next" });
    fireEvent.click(continueButton);
    await waitFor(() => expect(dashboard.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" }), { timeout: 2_200 });
    await waitFor(() => expect(useTutorialStore.getState().step).toBe(3), { timeout: 2_500 });
    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });
  });

  it("completes when the real start-learning target is clicked", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 3, testMode: false });
    render(<TutorialFixture />);
    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });
    fireEvent.click(screen.getByRole("button", { name: "start" }));
    expect(useTutorialStore.getState()).toMatchObject({
      active: false,
      completed: true,
      step: 4,
      testMode: false,
    });
    expect(screen.getByText("started")).toBeInTheDocument();
  });

  it("does not stay visible after completing in test mode", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 3, testMode: true });
    render(<TutorialFixture />);

    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });
    fireEvent.click(screen.getByRole("button", { name: "start" }));

    await waitFor(() => expect(document.querySelector("[data-landing-tutorial]")).not.toBeInTheDocument());
    expect(useTutorialStore.getState().completed).toBe(true);
  });

  it("persists completion before the real start-learning handler unmounts the tutorial", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 3, testMode: false });
    render(<NavigatingTutorialFixture />);

    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });
    fireEvent.click(screen.getByRole("button", { name: "start" }));

    expect(await screen.findByTestId("learn-route")).toBeInTheDocument();
    expect(useTutorialStore.getState()).toMatchObject({
      active: false,
      completed: true,
      step: 4,
      testMode: false,
    });

    const stored = JSON.parse(window.localStorage.getItem("foxiesdeck:tutorial") ?? "{}") as {
      state?: { active?: boolean; completed?: boolean; step?: number };
    };
    expect(stored.state).toMatchObject({ active: false, completed: true, step: 4 });
  });
});

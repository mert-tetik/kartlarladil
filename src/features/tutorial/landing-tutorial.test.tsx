import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingTutorial } from "@/features/tutorial/landing-tutorial";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { TUTORIAL_CARD_LAYER_REQUESTED_EVENT } from "@/features/tutorial/tutorial-card-session";
import { playTutorialSpeech, preloadTutorialSpeech, stopTutorialSpeech } from "@/features/tutorial/tutorial-speech";
import { vibrate } from "@/lib/vibration";

const {
  playFlowButtonSoundMock,
  resetFlowButtonSoundMock,
  playTutorialSpeechMock,
  preloadTutorialSpeechMock,
  stopTutorialSpeechMock,
  frameSequencePlayerMock,
} = vi.hoisted(() => ({
  playFlowButtonSoundMock: vi.fn(),
  resetFlowButtonSoundMock: vi.fn(),
  playTutorialSpeechMock: vi.fn(),
  preloadTutorialSpeechMock: vi.fn(),
  stopTutorialSpeechMock: vi.fn(),
  frameSequencePlayerMock: {
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    onEnded: undefined as (() => void) | undefined,
    onPlay: undefined as ((currentTime: number) => void) | undefined,
    onError: undefined as (() => void) | undefined,
    onReady: undefined as (() => void) | undefined,
    preload: vi.fn<(assetId: string, count: number) => Promise<boolean>>(),
    ready: true,
  },
}));

vi.mock("@/components/webp-frame-sequence-player", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  type MockPlayerHandle = {
    play: () => void;
    pause: () => void;
    seek: (seconds: number) => void;
    currentTime: number;
    duration: number;
    paused: boolean;
    ended: boolean;
  };
  type MockPlayerProps = {
    assetId: string;
    onReady?: () => void;
    onPlay?: (currentTime: number) => void;
    onEnded?: () => void;
    onError?: () => void;
    "data-player-id"?: string;
    className?: string;
  };
  return {
    getWebpFrameSequenceFrameCount: () => 97,
    getWebpFrameSequenceFrameSource: (assetId: string, index: number) =>
      `/mascots/${assetId}/frames/frame-${String(index + 1).padStart(3, "0")}.webp?v=20261104-webp-frames-1`,
    preloadWebpFrameSequence: (assetId: string, count: number) => frameSequencePlayerMock.preload(assetId, count),
    WebpFrameSequencePlayer: React.forwardRef<MockPlayerHandle, MockPlayerProps>(function MockWebpFrameSequencePlayer(props, ref) {
      const { assetId, className, onReady, onPlay, onEnded, onError } = props;
      React.useImperativeHandle(ref, () => ({
        play: frameSequencePlayerMock.play,
        pause: frameSequencePlayerMock.pause,
        seek: frameSequencePlayerMock.seek,
        currentTime: 0,
        duration: 97 / 45,
        paused: true,
        ended: false,
      }));
      React.useEffect(() => {
        frameSequencePlayerMock.onReady = onReady;
        if (frameSequencePlayerMock.ready) onReady?.();
      }, [onReady]);
      React.useEffect(() => {
        frameSequencePlayerMock.onPlay = onPlay;
        frameSequencePlayerMock.onEnded = onEnded;
        frameSequencePlayerMock.onError = onError;
      }, [onEnded, onError, onPlay]);
      return React.createElement("canvas", {
        "data-webp-frame-sequence-player": assetId,
        "data-player-id": props["data-player-id"],
        className,
      });
    }),
  };
});

vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: "en" }),
  useT: () => (key: string) => key,
}));

vi.mock("@/lib/vibration", () => ({ vibrate: vi.fn() }));
vi.mock("@/lib/flow-button-sound", () => ({
  playFlowButtonSound: (...args: unknown[]) => playFlowButtonSoundMock(...args),
  resetFlowButtonSoundSequence: (...args: unknown[]) => resetFlowButtonSoundMock(...args),
}));
vi.mock("@/features/tutorial/tutorial-speech", () => ({
  getTutorialSpeechKeyForTranslationKey: (translationKey: string) => ({
    "tutorial.cardCollectionPrompt": "card-collection-prompt",
    "tutorial.landingCardsAction": "landing-cards-action",
    "tutorial.landingCardsMessage": "landing-cards-message",
    "tutorial.landingStartLearningAction": "landing-start-learning-action",
  }[translationKey] ?? null),
  playTutorialSpeech: playTutorialSpeechMock,
  preloadTutorialSpeech: preloadTutorialSpeechMock,
  stopTutorialSpeech: stopTutorialSpeechMock,
}));

function TutorialFixture({ cardSwipeEntryComplete = true }: { cardSwipeEntryComplete?: boolean } = {}) {
  const [layer, setLayer] = useState<string | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [nestedInteraction, setNestedInteraction] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [subscriptionAction, setSubscriptionAction] = useState(false);

  return (
    <>
      <section data-mobile-landing-dashboard>
        <button type="button" data-tutorial-target="landing-draw-cards" onClick={() => setLayer("draw-cards")}>draw</button>
        <button type="button" data-tutorial-target="landing-create-card" onClick={() => setLayer("custom-card")}>custom</button>
        <button type="button" data-tutorial-target="landing-card-groups" onClick={() => setLayer("card-groups")}>groups</button>
        <button type="button" data-tutorial-target="landing-card-center" onClick={() => setCardsOpen((open) => !open)}>cards</button>
        <button type="button" data-tutorial-target="start-learning" onClick={() => setStarted(true)}>start</button>
        {cardsOpen ? <div id="mobile-card-center-content">card collection</div> : null}
      </section>
      {layer ? <div className={layer === "draw-cards" ? "card-swipe-overlay" : undefined} data-card-swipe-entry-complete={layer === "draw-cards" ? cardSwipeEntryComplete : undefined} data-tutorial-layer={layer} aria-hidden="false"><button type="button" onClick={() => setLayer(null)}>close layer</button><button type="button" onClick={() => setSubscriptionOpen(true)}>open subscription details</button></div> : null}
      {layer ? <div data-tutorial-layer-portal={layer}><button type="button" onClick={() => setNestedInteraction(true)}>nested layer action</button></div> : null}
      {subscriptionOpen ? createPortal(<section aria-modal="true" data-tutorial-subscription-overlay role="dialog"><button type="button" onClick={() => setSubscriptionAction(true)}>subscription action</button><button type="button" onClick={() => setSubscriptionOpen(false)}>close subscription details</button></section>, document.body) : null}
      {started ? <p>started</p> : null}
      {nestedInteraction ? <p>nested interaction</p> : null}
      {subscriptionAction ? <p>subscription action complete</p> : null}
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
    vi.mocked(vibrate).mockClear();
    vi.mocked(playTutorialSpeech).mockClear();
    vi.mocked(preloadTutorialSpeech).mockClear();
    vi.mocked(stopTutorialSpeech).mockClear();
    playFlowButtonSoundMock.mockClear();
    resetFlowButtonSoundMock.mockClear();
    frameSequencePlayerMock.play.mockClear();
    frameSequencePlayerMock.pause.mockClear();
    frameSequencePlayerMock.seek.mockClear();
    frameSequencePlayerMock.onEnded = undefined;
    frameSequencePlayerMock.onPlay = undefined;
    frameSequencePlayerMock.onError = undefined;
    frameSequencePlayerMock.onReady = undefined;
    frameSequencePlayerMock.preload.mockReset().mockResolvedValue(true);
    frameSequencePlayerMock.ready = true;
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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", { configurable: true, value: originalRect });
    useTutorialStore.setState({ active: false, completed: false, introSeen: false, step: 0, testMode: false });
  });

  it("shows two welcome screens before the choice screen and omits the old description", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: false, step: 0, testMode: false });
    frameSequencePlayerMock.ready = false;
    let resolveInitialFrames: ((ready: boolean) => void) | undefined;
    frameSequencePlayerMock.preload.mockReturnValue(new Promise((resolve) => {
      resolveInitialFrames = resolve;
    }));
    render(<TutorialFixture />);

    expect(await screen.findByRole("status", { name: "Starting tutorial" })).toBeInTheDocument();
    const firstWelcome = await screen.findByRole("dialog", { name: "tutorial.welcome" });
    expect(firstWelcome).toBeInTheDocument();
    await waitFor(() => expect(playTutorialSpeech).toHaveBeenCalledWith("welcome", "en"));
    const welcomeRevealCircle = firstWelcome.querySelector(".tutorial-origin-overlay__circle");
    const welcomeViewport = firstWelcome.querySelector(".tutorial-origin-overlay__viewport");
    expect(welcomeRevealCircle).toBeInTheDocument();
    expect(welcomeViewport).toBeInTheDocument();
    expect(welcomeRevealCircle?.nextElementSibling).toBe(welcomeViewport);
    const firstWelcomeTitle = screen.getByRole("heading", { name: "tutorial.welcome" });
    expect(firstWelcomeTitle).toHaveClass("mt-4", "text-center");
    expect(document.querySelector("[data-tutorial-welcome-content] [data-tutorial-welcome-step-title]")).toBe(firstWelcomeTitle);
    expect(firstWelcomeTitle).not.toHaveClass("absolute");
    expect(document.querySelector("[data-tutorial-welcome-description]")).not.toBeInTheDocument();
    expect(decodeURIComponent(document.querySelector("[data-tutorial-welcome-first-frame]")?.getAttribute("src") ?? "")).toContain("tutorial-welcome/frames/frame-001.webp?v=20261104-webp-frames-1");
    const mediaAnchor = document.querySelector("[data-tutorial-welcome-media]");
    expect(mediaAnchor).toHaveStyle({ top: "calc(50% - 6.25rem)" });
    expect(document.querySelector("[data-tutorial-welcome-media-spacer]")).toBeInTheDocument();
    expect(document.querySelector("[data-tutorial-welcome-first-frame]")).toHaveClass("scale-[1.5]");
    const videoPlay = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const mediaPause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);

    const firstNextButton = screen.getByRole("button", { name: "tutorial.next" });
    expect(frameSequencePlayerMock.preload).toHaveBeenCalledWith("tutorial-welcome", 97);
    expect(firstNextButton).toHaveClass("text-lg", "font-super-water");
    expect(firstNextButton).toBeDisabled();
    expect(firstNextButton).toHaveAttribute("aria-busy", "true");
    expect(firstNextButton.querySelector("svg.animate-spin")).toBeInTheDocument();
    await act(async () => {
      resolveInitialFrames?.(true);
      await Promise.resolve();
    });
    expect(firstNextButton).toBeDisabled();
    act(() => frameSequencePlayerMock.onReady?.());
    await waitFor(() => expect(firstNextButton).toBeEnabled());
    fireEvent.click(firstNextButton);
    expect(vibrate).toHaveBeenCalledWith("tutorial-next");
    const secondWelcome = screen.getByRole("dialog", { name: "tutorial.welcomeAddCards" });
    expect(secondWelcome).toBe(firstWelcome);
    expect(document.querySelector("[data-tutorial-welcome-frame-poster]")).not.toBeInTheDocument();
    expect(document.querySelector("[data-landing-tutorial-transition]")).not.toBeInTheDocument();
    expect(document.querySelector("[data-tutorial-welcome-description]")).not.toBeInTheDocument();
    const framePlayer = document.querySelector('[data-webp-frame-sequence-player="tutorial-welcome"]') as HTMLCanvasElement;
    expect(document.querySelector("[data-tutorial-welcome-media]")).toBe(mediaAnchor);
    expect(framePlayer).toHaveClass("scale-[1.5]");
    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(document.querySelector("[data-tutorial-welcome-audio]")?.getAttribute("src")).toBe("/mascots/tutorial-welcome/mascot-audio.m4a?v=20261024-45fps-1");
    expect(frameSequencePlayerMock.play).toHaveBeenCalledTimes(1);
    expect(videoPlay).not.toHaveBeenCalled();
    act(() => frameSequencePlayerMock.onPlay?.(0));
    expect(videoPlay).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "tutorial.welcomeAddCards" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "tutorial.next" })).not.toBeInTheDocument();
    expect(document.querySelector("[data-tutorial-welcome-last-frame]")).not.toBeInTheDocument();
    act(() => frameSequencePlayerMock.onEnded?.());

    await waitFor(() => {
      const addCardsTitle = screen.getByRole("heading", { name: "tutorial.welcomeAddCards" });
      expect(addCardsTitle).toHaveClass("tutorial-welcome-ui-scale-in", "mt-4", "text-center");
      expect(addCardsTitle).toHaveStyle({ translate: "0 35px" });
      expect(document.querySelector("[data-tutorial-welcome-content] [data-tutorial-welcome-step-title]")).toBe(addCardsTitle);
      expect(addCardsTitle).not.toHaveClass("absolute");
      const addCardsNextButton = screen.getByRole("button", { name: "tutorial.addCards" });
      expect(addCardsNextButton).toHaveClass("tutorial-welcome-ui-scale-in", "text-lg", "font-super-water");
      expect(addCardsNextButton).toHaveStyle({ translate: "0 35px" });
      expect(document.querySelector('[data-webp-frame-sequence-player="tutorial-welcome"]')).toBe(framePlayer);
      expect(document.querySelector("[data-tutorial-welcome-last-frame]")).not.toBeInTheDocument();
      expect(document.querySelector("[data-tutorial-welcome-frame-poster]")).not.toBeInTheDocument();
      expect(framePlayer).not.toHaveClass("opacity-0");
    }, { timeout: 3_000 });
    expect(playTutorialSpeech).toHaveBeenCalledWith("welcome-add-cards", "en");
    expect(mediaPause).toHaveBeenCalledTimes(1);
    expect(frameSequencePlayerMock.pause).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "tutorial.addCards" }));
    const cardModesScreen = await screen.findByRole("dialog", { name: "tutorial.cardModes.title" }, { timeout: 5_000 });
    expect(cardModesScreen).toHaveClass("z-[1001]");
    expect(document.querySelector("[data-tutorial-welcome-underlay]")).not.toHaveClass("tutorial-origin-overlay--closing");
    const firstChoice = screen.getByRole("button", { name: /tutorial\.cardModes\.random\.title/ });
    expect(firstChoice).toBeDisabled();

    await waitFor(() => expect(document.querySelector("[data-tutorial-welcome-underlay]")).not.toBeInTheDocument(), { timeout: 1_500 });
    expect(document.querySelector("[data-landing-tutorial-choice-screen]")).toBe(cardModesScreen);
    expect(firstChoice).not.toBeDisabled();
  });

  it("shows the final still immediately if the WebP frame sequence fails to load", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: false, step: 0, testMode: false });
    render(<TutorialFixture />);

    await screen.findByRole("dialog", { name: "tutorial.welcome" }, { timeout: 3_500 });
    act(() => frameSequencePlayerMock.onError?.());
    fireEvent.click(screen.getByRole("button", { name: "tutorial.next" }));

    expect(await screen.findByRole("dialog", { name: "tutorial.welcomeAddCards" })).toBeInTheDocument();
    expect(document.querySelector("video")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "tutorial.welcomeAddCards" })).toBeInTheDocument();
    expect(document.querySelector("[data-tutorial-welcome-last-frame]")).toBeInTheDocument();
    expect(document.querySelector('[data-webp-frame-sequence-player="tutorial-welcome"]')).toHaveClass("opacity-0");
  });

  it("falls back instead of leaving the welcome flow stuck when the complete frame sequence is slow", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: false, step: 0, testMode: false });
    frameSequencePlayerMock.ready = false;
    const videoPlay = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    render(<TutorialFixture />);

    await screen.findByRole("dialog", { name: "tutorial.welcome" }, { timeout: 3_500 });
    const nextButton = screen.getByRole("button", { name: "tutorial.next" });
    expect(nextButton).toBeDisabled();
    act(() => frameSequencePlayerMock.onError?.());
    await waitFor(() => expect(nextButton).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "tutorial.next" }));
    expect(videoPlay).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "tutorial.welcomeAddCards" })).toBeInTheDocument();
      expect(document.querySelector("[data-tutorial-welcome-last-frame]")).toBeInTheDocument();
    }, { timeout: 3_500 });
    expect(frameSequencePlayerMock.pause).toHaveBeenCalled();

    act(() => frameSequencePlayerMock.onPlay?.(0));
    expect(videoPlay).not.toHaveBeenCalled();
  });

  it("renders exactly three card mode choices and blocks the landing below them", async () => {
    render(<TutorialFixture />);
    expect(await screen.findByRole("dialog", { name: "tutorial.cardModes.title" })).toBeInTheDocument();
    expect(document.querySelector("[data-landing-tutorial-choice-screen] .tutorial-origin-overlay__circle")).toBeInTheDocument();
    expect(document.querySelector("[data-landing-tutorial-choice-screen] .tutorial-origin-overlay__viewport")).toBeInTheDocument();
    const choices = document.querySelectorAll("[data-landing-tutorial-choice]");
    expect(choices).toHaveLength(3);
    expect(document.querySelector("[data-landing-tutorial-choice-screen] .grid")).toHaveClass("py-5");
    choices.forEach((choice) => expect(choice.querySelector("span > span")).toHaveClass("text-2xl"));
    choices.forEach((choice) => expect(choice.querySelector("span > span + span")).not.toBeInTheDocument());
    expect(document.querySelector('[data-tutorial-choice="random"]')).toHaveClass("text-[#332417]");
    expect(document.querySelector('[data-tutorial-choice="groups"]')).toHaveClass("text-[#202c16]");

    fireEvent.click(screen.getByRole("button", { name: "cards" }));
    expect(document.querySelector("#mobile-card-center-content")).not.toBeInTheDocument();
  });

  it("animates a choice even when its landing target has no visible layout", async () => {
    render(<TutorialFixture />);
    const target = document.querySelector<HTMLElement>('[data-tutorial-target="landing-draw-cards"]');
    expect(target).not.toBeNull();
    target!.style.display = "none";

    fireEvent.click(await screen.findByRole("button", { name: /tutorial\.cardModes\.random\.title/ }));

    const closingChoiceScreen = document.querySelector<HTMLElement>("[data-landing-tutorial-choice-screen]");
    expect(closingChoiceScreen).toHaveClass("tutorial-origin-overlay--closing");
    expect(closingChoiceScreen?.querySelector("[data-tutorial-choice-exit-viewport]")).toBeInTheDocument();
  });

  it("opens the selected real layer and continues one second after it closes", async () => {
    render(<TutorialFixture />);
    const choice = await screen.findByRole("button", { name: /tutorial\.cardModes\.random\.title/ }, { timeout: 3_500 });
    fireEvent.click(choice);
    expect(vibrate).toHaveBeenCalledWith("tutorial-next");
    const closingChoiceScreen = document.querySelector<HTMLElement>("[data-landing-tutorial-choice-screen]");
    expect(closingChoiceScreen).toHaveClass("tutorial-origin-overlay--closing");
    expect(closingChoiceScreen?.querySelector("[data-tutorial-choice-exit-viewport]")).toBeInTheDocument();
    expect(closingChoiceScreen?.querySelector("h2")?.style.animationDelay).toBe("0ms");
    const exitingChoices = Array.from(closingChoiceScreen?.querySelectorAll<HTMLButtonElement>("[data-landing-tutorial-choice]") ?? []);
    expect(exitingChoices.map((item) => item.style.animationDelay)).toEqual(["160ms", "320ms", "480ms"]);
    fireEvent.animationEnd(exitingChoices[0], { animationName: "tutorial-choice-item-scale-exit" });
    expect(document.querySelector("[data-landing-tutorial-choice-screen]")).toBeInTheDocument();
    fireEvent.animationEnd(exitingChoices[2], { animationName: "tutorial-choice-item-scale-exit" });
    expect(document.querySelector("[data-landing-tutorial-choice-screen]")).toBeInTheDocument();
    const exitCircle = closingChoiceScreen?.querySelector(".tutorial-origin-overlay__circle");
    expect(exitCircle).toBeInTheDocument();
    fireEvent.animationEnd(exitCircle!, { animationName: "tutorial-circle-screen-exit" });
    expect(await screen.findByText("close layer", {}, { timeout: 3_500 })).toBeInTheDocument();
    expect(document.querySelector("[data-landing-tutorial-choice-screen]")).not.toBeInTheDocument();
    const layerPrompt = await screen.findByTestId("tutorial-layer-message", {}, { timeout: 2_000 });
    expect(playTutorialSpeech).toHaveBeenCalledWith("card-collection-prompt", "en");
    const character = layerPrompt.querySelector("[data-tutorial-layer-message-character]");
    const bubble = layerPrompt.querySelector("[data-tutorial-layer-message-bubble]");
    expect(character).toBeInTheDocument();
    expect(bubble).toBeInTheDocument();
    expect(bubble).toHaveClass("text-lg", "font-super-water", "bg-brand", "text-white", "before:bg-brand");
    await waitFor(() => expect(layerPrompt).toHaveAttribute("aria-busy", "true"), { timeout: 3_500 });
    expect(layerPrompt).toHaveClass("tutorial-origin-overlay--closing");
    expect(character).toBeInTheDocument();
    expect(bubble).toBeInTheDocument();
    const stopsBeforeAutomaticClose = vi.mocked(stopTutorialSpeech).mock.calls.length;
    await waitFor(() => expect(screen.queryByTestId("tutorial-layer-message")).not.toBeInTheDocument(), { timeout: 4_000 });
    expect(stopTutorialSpeech).toHaveBeenCalledTimes(stopsBeforeAutomaticClose);

    fireEvent.click(screen.getByRole("button", { name: "close layer" }));
    await waitFor(() => expect(useTutorialStore.getState().step).toBe(1), { timeout: 2_500 });
    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });
  });

  it("waits for the draw-card screen entrance before showing its tutorial prompt", async () => {
    const { rerender } = render(<TutorialFixture cardSwipeEntryComplete={false} />);
    const choice = await screen.findByRole("button", { name: /tutorial\.cardModes\.random\.title/ }, { timeout: 5_000 });
    fireEvent.click(choice);

    expect(await screen.findByRole("button", { name: "close layer" }, { timeout: 3_500 })).toBeInTheDocument();
    expect(document.querySelector("[data-card-swipe-entry-complete='false']")).toBeInTheDocument();
    expect(screen.queryByTestId("tutorial-layer-message")).not.toBeInTheDocument();

    rerender(<TutorialFixture cardSwipeEntryComplete />);
    expect(await screen.findByTestId("tutorial-layer-message", {}, { timeout: 2_000 })).toBeInTheDocument();
  });

  it("opens a layer through the direct tutorial request when the target click is guarded", async () => {
    render(<EventDrivenLayerTutorialFixture />);

    const choice = await screen.findByRole("button", { name: /tutorial\.cardModes\.random\.title/ });
    fireEvent.click(choice);

    expect(await screen.findByText("close layer", {}, { timeout: 3_500 })).toBeInTheDocument();
    expect(await screen.findByTestId("tutorial-layer-message", {}, { timeout: 2_000 })).toBeInTheDocument();
  });

  it("opens the selected layer when its landing target has no visible layout", async () => {
    render(<EventDrivenLayerTutorialFixture />);
    const target = document.querySelector<HTMLElement>('[data-tutorial-target="landing-draw-cards"]');
    expect(target).not.toBeNull();
    target!.style.display = "none";

    fireEvent.click(await screen.findByRole("button", { name: /tutorial\.cardModes\.random\.title/ }));

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

  it("allows the subscription details portal without completing or advancing the tutorial", async () => {
    render(<TutorialFixture />);

    const choice = await screen.findByRole("button", { name: /tutorial\.cardModes\.random\.title/ }, { timeout: 5_000 });
    fireEvent.click(choice);
    expect(await screen.findByRole("button", { name: "open subscription details" }, { timeout: 3_500 })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("tutorial-layer-message")).not.toBeInTheDocument(), { timeout: 4_000 });

    fireEvent.click(screen.getByRole("button", { name: "open subscription details" }));
    const subscriptionDialog = await screen.findByRole("dialog");
    expect(subscriptionDialog).toHaveAttribute("data-tutorial-subscription-overlay");
    fireEvent.click(screen.getByRole("button", { name: "subscription action" }));

    expect(screen.getByText("subscription action complete")).toBeInTheDocument();
    expect(useTutorialStore.getState()).toMatchObject({ active: true, completed: false, step: 0 });
    expect(screen.getByRole("button", { name: "close layer" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "close subscription details" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "close layer" })).toBeInTheDocument();
    expect(useTutorialStore.getState()).toMatchObject({ active: true, completed: false, step: 0 });
  });

  it("immediately removes the cards target overlay on click, then shows its message", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 1, testMode: false });
    render(<TutorialFixture />);
    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });
    const targetViewport = document.querySelector("[data-landing-tutorial-phase=target] .tutorial-origin-overlay__viewport");
    expect(targetViewport).toBeInTheDocument();
    expect(targetViewport?.querySelectorAll(".fixed")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "cards" }));
    expect(document.querySelector("#mobile-card-center-content")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('[data-landing-tutorial-phase="target"]')).not.toBeInTheDocument());
    expect(document.querySelector("[data-landing-tutorial-transition]")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-landing-tutorial-rect-mask]")).toHaveLength(0);
    expect(document.querySelector("[data-landing-tutorial-spotlight]")).not.toBeInTheDocument();
    expect(document.querySelector("[data-tutorial-arrow-image]")).not.toBeInTheDocument();
    expect(document.querySelector("[data-landing-tutorial-callout]")).not.toBeInTheDocument();
    expect(document.querySelector("#mobile-card-center-content")).toBeInTheDocument();
    await waitFor(() => expect(useTutorialStore.getState().step).toBe(2), { timeout: 2_500 });
    expect(document.querySelector("[data-landing-tutorial-spotlight]")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "tutorial.collectionMessageButton" })).toBeInTheDocument();
    expect(screen.getByText("tutorial.landingCardsMessage")).toBeInTheDocument();
    const message = document.querySelector<HTMLElement>("[data-landing-tutorial-message]");
    expect(message).toHaveClass("text-lg", "font-super-water", "bg-brand", "text-white");
    expect(message?.querySelector("[data-tutorial-message-tail-outline]")).toHaveAttribute("d", "M20 1.5L1.5 16L20 30.5");
    expect(message?.querySelector("[data-tutorial-message-tail] rect")).not.toBeInTheDocument();
    expect(message?.querySelector("[data-tutorial-message-tail]")).toHaveAttribute("viewBox", "0 0 24 32");
    expect(message?.querySelector("[data-tutorial-message-tail] path[data-tutorial-message-tail-outline]")).toHaveAttribute("stroke-linecap", "butt");
    expect(message?.style.transform).toBe("");
    expect(document.querySelector("#mobile-card-center-content")).toBeInTheDocument();
    expect(playTutorialSpeech).toHaveBeenCalledWith("landing-cards-message", "en");
    fireEvent.click(screen.getByRole("button", { name: "tutorial.collectionMessageButton" }));
    expect(stopTutorialSpeech).not.toHaveBeenCalled();
  });

  it("speaks target callouts in the selected UI language and leaves speech running when a target closes the screen", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 1, testMode: false });
    render(<TutorialFixture />);

    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-message]")).toBeInTheDocument());
    expect(playTutorialSpeech).toHaveBeenCalledWith("landing-cards-action", "en");
    expect(resetFlowButtonSoundMock).toHaveBeenCalledWith("tutorial");

    fireEvent.click(screen.getByRole("button", { name: "cards" }));
    expect(stopTutorialSpeech).not.toHaveBeenCalled();
    expect(playFlowButtonSoundMock).toHaveBeenCalledWith("tutorial");
    expect(playFlowButtonSoundMock).toHaveBeenCalledOnce();
  });

  it.each([
    { direction: 1, step: 1, viewportHeight: 844 },
    { direction: -1, step: 3, viewportHeight: 1600 },
  ])("uses the tutorial arrow image at its natural aspect ratio and points it toward the target (direction $direction)", async ({ direction, step, viewportHeight }) => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: viewportHeight });
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step, testMode: false });
    render(<TutorialFixture />);

    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });

    const arrow = document.querySelector<HTMLImageElement>("[data-tutorial-arrow-image]");
    const spotlight = document.querySelector("[data-landing-tutorial-spotlight]");
    expect(arrow).toBeInTheDocument();
    expect(spotlight).toHaveClass("border-brand");
    expect(spotlight).not.toHaveClass("border-red-500");
    expect(arrow?.getAttribute("src")).toContain("arrow.webp");
    expect(arrow).toHaveAttribute("width", "433");
    expect(arrow).toHaveAttribute("height", "305");
    expect(Number(arrow?.getAttribute("width")) / Number(arrow?.getAttribute("height"))).toBeCloseTo(433 / 305);
    expect(Number.parseFloat(arrow?.style.width ?? "")).toBeCloseTo(112 * 0.8);
    expect(arrow?.style.getPropertyValue("--tutorial-arrow-rest-top")).toBe(`${arrow?.style.top}`);
    expect(arrow).toHaveAttribute("data-tutorial-arrow-direction", direction > 0 ? "down" : "up");
    expect(arrow?.style.getPropertyValue("--tutorial-arrow-rotation")).toBe(`${direction * 90}deg`);

    const expectedOffsetX = step === 1 ? -75 : 0;
    const targetSelector = step === 1 ? "landing-card-center" : "start-learning";
    const target = document.querySelector<HTMLElement>(`[data-tutorial-target="${targetSelector}"]`);
    const callout = document.querySelector<HTMLElement>("[data-tutorial-callout-position]");
    const message = document.querySelector<HTMLElement>("[data-landing-tutorial-message]");
    expect(message).toHaveClass("text-lg", "font-super-water", "bg-brand", "text-white", "before:bg-brand");
    expect(message?.style.transform).toBe(step === 3 ? "translateY(-20px)" : "");
    expect(arrow).toHaveAttribute("data-tutorial-arrow-offset-x", String(expectedOffsetX));
    expect(Number.parseFloat(arrow?.style.left ?? "")).toBe((target?.getBoundingClientRect().left ?? 0) + (target?.getBoundingClientRect().width ?? 0) / 2 + expectedOffsetX);
    expect(callout?.style.top).toBe(step === 1 ? "404px" : "698px");

    const originalAnchorY = Number(arrow?.getAttribute("data-tutorial-arrow-anchor-y"));
    const preservedTipOffset = Number(arrow?.getAttribute("data-tutorial-arrow-tip-offset"));
    const actualTipY = Number(arrow?.getAttribute("data-tutorial-arrow-tip-y"));
    const imageCenterY = Number.parseFloat(arrow?.style.top ?? "");
    const renderedImageWidth = Number.parseFloat(arrow?.style.width ?? "");

    expect(preservedTipOffset).toBe(direction * 22);
    expect(actualTipY).toBe(originalAnchorY + preservedTipOffset);
    expect(imageCenterY + direction * renderedImageWidth / 2).toBe(actualTipY);
  });

  it("starts the tutorial arrow scale animation only after its image loads", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 1, testMode: false });
    render(<TutorialFixture />);

    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });
    const arrow = document.querySelector<HTMLImageElement>("[data-tutorial-arrow-image]");
    expect(arrow).toBeInTheDocument();
    expect(arrow?.style.animationPlayState).toBe("paused");

    fireEvent.load(arrow!);

    await waitFor(() => expect(arrow?.style.animationPlayState).toBe("running"));
  });

  it("scrolls at 400ms and reaches the learning target after message continue", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 2, testMode: false });
    render(<TutorialFixture />);
    const dashboard = document.querySelector("[data-mobile-landing-dashboard]") as HTMLElement;
    dashboard.scrollTo = vi.fn();
    const continueButton = await screen.findByRole("button", { name: "tutorial.collectionMessageButton" }, { timeout: 3_500 });
    expect(continueButton).toHaveClass("text-lg", "font-super-water", "translate-y-[30px]");
    fireEvent.click(continueButton);
    expect(vibrate).toHaveBeenCalledWith("tutorial-next");
    const callout = document.querySelector<HTMLElement>("[data-tutorial-message-callout]");
    const character = document.querySelector<HTMLElement>('[data-tutorial-message-exit-part="character"]');
    const bubble = document.querySelector<HTMLElement>('[data-tutorial-message-exit-part="bubble"]');
    expect(callout).toHaveAttribute("data-tutorial-message-exit", "true");
    expect(continueButton).toHaveAttribute("data-tutorial-message-exit", "true");
    expect(bubble?.style.animationDelay).toBe("0ms");
    expect(character?.style.animationDelay).toBe("160ms");
    expect(continueButton.style.animationDelay).toBe("320ms");
    await waitFor(() => expect(dashboard.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" }), { timeout: 2_200 });
    await waitFor(() => expect(useTutorialStore.getState().step).toBe(3), { timeout: 2_500 });
    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });
  });

  it("completes when the real start-learning target is clicked", async () => {
    useTutorialStore.setState({ active: true, completed: false, introSeen: true, step: 3, testMode: false });
    render(<TutorialFixture />);
    await waitFor(() => expect(document.querySelector("[data-landing-tutorial-spotlight]")).toBeInTheDocument(), { timeout: 1_500 });
    fireEvent.click(screen.getByRole("button", { name: "start" }));

    expect(vibrate).toHaveBeenCalledWith("firm-tap");
    expect(screen.getByText("started")).toBeInTheDocument();
    expect(document.querySelector("[data-landing-tutorial]")).not.toBeInTheDocument();
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

    expect(vibrate).toHaveBeenCalledWith("firm-tap");
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

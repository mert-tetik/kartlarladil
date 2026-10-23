import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import * as cardSpeech from "@/features/cards/card-speech";
import { CARD_SPEECH_STATUS_EVENT } from "@/features/cards/card-speech";
import { playSoundEffect } from "@/lib/sound-effects";
import { CardDesignTestScreen } from "@/features/cards/components/card-design-test-screen";

vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

describe("CardDesignTestScreen", () => {
  it("shows the reference design details and four resize handles at the reference ratio", () => {
    render(<CardDesignTestScreen />);

    expect(screen.getByTestId("reference-card")).toBeInTheDocument();
    expect(screen.getByTestId("card-progress-mode")).toBeInTheDocument();
    const progressCircle = screen.getByTestId("reference-card").querySelector("[data-card-progress][role='progressbar']");
    expect(progressCircle).toBeInTheDocument();
    expect(progressCircle?.querySelector("[data-progress-slice-dividers]")).toBeInTheDocument();
    expect(progressCircle?.querySelector("[data-progress-indicator]")).toHaveStyle({
      "--fd-card-progress-angle": "0deg",
      "--fd-card-progress-slice-angle": "60deg",
    });
    expect(screen.getByText("経済")).toBeVisible();
    expect(screen.getByText("economy")).toBeVisible();
    expect(screen.getByTestId("card-term")).toHaveClass("fd-card-design__term");
    expect(screen.getByTestId("card-translation")).toHaveClass("fd-card-design__translation");
    expect(screen.getByTestId("card-reference-example")).toHaveClass("fd-card-design__example");
    expect(screen.getByTestId("card-term").querySelector("[data-single-line-fit-content]")).toHaveClass("whitespace-nowrap");
    expect(screen.getByTestId("card-translation").querySelector("[data-single-line-fit-content]")).toHaveClass("whitespace-nowrap");
    expect(screen.getByTestId("card-term").querySelector("[data-single-line-fit-container]")).toHaveAttribute("data-single-line-fit-centered");
    expect(screen.getByTestId("card-translation").querySelector("[data-single-line-fit-container]")).toHaveAttribute("data-single-line-fit-centered");
    expect(screen.getByTestId("card-pronunciation")).toHaveTextContent("keizai");
    const pronunciationButton = within(screen.getByTestId("card-pronunciation")).getByRole("button", { name: /^Listen to / });
    expect(pronunciationButton).toBeVisible();
    expect(pronunciationButton.querySelector("svg")).toHaveClass("fd-card-design__speaker-icon");
    expect(screen.getByTestId("card-reference-example")).toHaveTextContent("最近、経済が少し 不安です。");
    const foxMark = screen.getByTestId("fox-carved-mark");
    expect(foxMark).toBeInTheDocument();
    expect(foxMark).toHaveClass("fd-card-design__front-fox");
    expect(foxMark.querySelectorAll("path")).toHaveLength(4);
    expect(Array.from(foxMark.querySelectorAll("path")).map((path) => path.getAttribute("stroke"))).toEqual([
      "#b29a70",
      "#fff7e4",
      "#a88f65",
      "#fff8e9",
    ]);
    expect(screen.getByTestId("card-tier-badge")).toHaveTextContent("B1");
    expect(screen.getByTestId("card-tier-badge")).toHaveClass("fd-card-design__tier-badge", "font-super-water");
    expect(screen.getByTestId("card-front-glass-outline")).toHaveAttribute("stroke", "#b163ff");
    expect(screen.getByTestId("card-preview-canvas")).toHaveStyle({ backgroundColor: "rgb(0, 0, 0)" });
    expect(screen.getByTestId("card-preview-frame")).toHaveStyle({ width: "320px", height: "456px" });
    expect(screen.getByTestId("card-aspect-ratio")).toHaveTextContent("0.702");
    expect(screen.getAllByRole("button", { name: /^Resize card from/ })).toHaveLength(4);
    expect(screen.getByTestId("card-learning-language")).toHaveAttribute("data-language", "ja");
    expect(screen.getByTestId("card-native-language")).toHaveAttribute("data-language", "en");
  });

  it("wiggles the pronunciation pill only while its word is being spoken", () => {
    render(<CardDesignTestScreen />);

    const term = screen.getByTestId("card-term");
    const pronunciation = screen.getByTestId("card-pronunciation");
    const dispatchStatus = (state: "start" | "end") => {
      window.dispatchEvent(new CustomEvent(CARD_SPEECH_STATUS_EVENT, {
        detail: { text: term.textContent?.trim(), language: term.getAttribute("lang"), state },
      }));
    };

    act(() => dispatchStatus("start"));
    expect(pronunciation).toHaveAttribute("data-pronunciation-speaking", "true");
    expect(pronunciation).toHaveClass("fd-card-design__pronunciation--speaking");

    act(() => dispatchStatus("end"));
    expect(pronunciation).toHaveAttribute("data-pronunciation-speaking", "false");
    expect(pronunciation).not.toHaveClass("fd-card-design__pronunciation--speaking");
  });

  it("switches between the progress and no-progress card modes", () => {
    render(<CardDesignTestScreen />);

    expect(screen.getByTestId("reference-card").querySelector("[data-card-progress]")).toBeInTheDocument();
    expect(screen.getByTestId("card-progress-count")).toHaveTextContent("0/6");
    expect(screen.getByTestId("advance-card-progress-button")).toBeEnabled();
    fireEvent.click(screen.getByTestId("progress-mode-off"));
    expect(screen.getByTestId("progress-mode-off")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("reference-card").querySelector("[data-card-progress]")).not.toBeInTheDocument();
    expect(screen.getByTestId("advance-card-progress-button")).toBeDisabled();

    fireEvent.click(screen.getByTestId("progress-mode-on"));
    expect(screen.getByTestId("progress-mode-on")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("reference-card").querySelector("[data-card-progress]")).toHaveTextContent("0/6");
  });

  it("advances one progress slice per level-up click and replays the shared animation", () => {
    render(<CardDesignTestScreen />);
    const playSoundEffectMock = vi.mocked(playSoundEffect);

    const progress = screen.getByTestId("reference-card").querySelector<HTMLElement>("[data-card-progress]")!;
    const advanceButton = screen.getByTestId("advance-card-progress-button");
    const initialPulse = progress.querySelector("[data-progress-indicator-overlay]");

    fireEvent.click(advanceButton);
    expect(progress).toHaveTextContent("1/6");
    expect(playSoundEffectMock).not.toHaveBeenCalled();
    expect(progress).toHaveAttribute("data-progress-animation-active", "true");
    expect(progress).toHaveAttribute("data-progress-animation-key", "1");
    expect(progress.querySelector("[data-progress-indicator]")).toHaveStyle({ "--fd-card-progress-angle": "60deg" });
    const firstStepPulse = progress.querySelector("[data-progress-indicator-overlay]");
    expect(firstStepPulse).not.toBe(initialPulse);

    fireEvent.click(advanceButton);
    expect(progress).toHaveTextContent("2/6");
    expect(progress).toHaveAttribute("data-progress-animation-key", "2");
    expect(progress.querySelector("[data-progress-indicator-overlay]")).not.toBe(firstStepPulse);

    for (let step = 3; step <= 6; step += 1) fireEvent.click(advanceButton);
    expect(progress).toHaveTextContent("6/6");
    expect(progress).toHaveAttribute("data-progress-complete", "true");
    expect(screen.getByTestId("card-progress-count")).toHaveTextContent("6/6");
    expect(advanceButton).toBeDisabled();
    expect(playSoundEffectMock).toHaveBeenCalledTimes(1);
    expect(playSoundEffectMock).toHaveBeenCalledWith("card-progress-complete");
  });

  it("speaks the vocabulary term from the pronunciation pill", () => {
    const speakCardTerm = vi.spyOn(cardSpeech, "speakCardTerm").mockReturnValue(true);

    render(<CardDesignTestScreen />);
    fireEvent.click(within(screen.getByTestId("card-pronunciation")).getByRole("button"));

    expect(speakCardTerm).toHaveBeenCalledWith(screen.getByTestId("card-term").textContent, "ja");
  });

  it("flips the preview card to its back and back to the front", () => {
    render(<CardDesignTestScreen />);

    const flipButton = screen.getByTestId("flip-card-button");
    expect(screen.getByTestId("card-face-state")).toHaveAttribute("data-card-face", "front");
    expect(screen.getByTestId("reference-card-back")).toBeInTheDocument();

    fireEvent.click(flipButton);
    expect(screen.getByTestId("card-face-state")).toHaveAttribute("data-card-face", "back");
    expect(screen.getByTestId("flip-card-button")).toHaveTextContent("Show card front");
    expect(screen.getByTestId("reference-card-back")).not.toHaveAttribute("style");
    expect(screen.getByTestId("card-back-glass-outline")).toHaveAttribute("stroke", "#b163ff");
    const frontShellStops = Array.from(screen.getByTestId("reference-card").querySelectorAll("linearGradient[id$='-front-shell'] stop"));
    const backShellStops = Array.from(screen.getByTestId("card-back-artwork").querySelectorAll("linearGradient[id$='-back-shell'] stop"));
    expect(backShellStops.map((stop) => stop.getAttribute("stop-color"))).toEqual(
      frontShellStops.map((stop) => stop.getAttribute("stop-color")),
    );
    expect(screen.getByTestId("card-back-tier-circle")).toHaveTextContent("B1");
    expect(screen.getByTestId("card-back-tier-text")).toHaveClass("font-super-water", "fd-card-design__back-tier-text");
    expect(screen.queryByTestId("card-back-tier-label")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-back-learning-language")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-back-native-language")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-back-flip-label")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-back-carved-outline")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-back-artwork").querySelector("pattern#card-back-icon-pattern")).toBeNull();
    expect(screen.getByTestId("card-back-fox-mark")).toHaveClass("fd-card-design__back-fox");
    expect(screen.getByTestId("card-back-fox-mark").querySelector("g")).toHaveAttribute("opacity", "0.14");
    expect(screen.getByTestId("card-back-fox-mark").querySelectorAll("path")).toHaveLength(2);
    expect(screen.getByTestId("card-back-fox-mark").querySelector("path")).toHaveAttribute("fill", "#ffffff");
    expect(screen.getByTestId("card-back-artwork").querySelectorAll("[data-card-back-wave]")).toHaveLength(2);
    expect(screen.getByTestId("card-back-tier-circle")).toHaveClass("fd-card-design__back-tier-circle");
    expect(screen.getByTestId("card-back-content")).toHaveClass("fd-card-design__back-content");
    expect(within(screen.getByTestId("reference-card-back")).queryByText("FoxiesDeck")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("reference-card-back")).queryByText("Vocabulary collection")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("flip-card-button"));
    expect(screen.getByTestId("card-face-state")).toHaveAttribute("data-card-face", "front");
  });

  it("randomizes the vocabulary card and changes both card languages", async () => {
    const randomizedSample = {
      cardId: "es-word-1",
      learningLanguage: "es",
      nativeLanguage: "de",
      tier: "A2",
      term: "sobremesa",
      translation: "Zeit am Tisch nach dem Essen",
      partOfSpeech: "noun",
      pronunciation: "sobremesa",
      example: "Nos quedamos de sobremesa.",
    };
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => randomizedSample,
    } as Response);

    render(<CardDesignTestScreen />);
    fireEvent.click(screen.getByTestId("randomize-card-button"));

    await waitFor(() => expect(screen.getByTestId("card-term")).toHaveTextContent("sobremesa"));
    expect(screen.getByText("Zeit am Tisch nach dem Essen")).toBeVisible();
    expect(screen.getByTestId("card-learning-language")).toHaveAttribute("data-language", "es");
    expect(screen.getByTestId("card-native-language")).toHaveAttribute("data-language", "de");
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/visual-test-card/random"), { cache: "no-store" });
  });

  it("localizes card-back labels using the card's native language", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        cardId: "es-word-1",
        learningLanguage: "es",
        nativeLanguage: "de",
        tier: "B1",
        term: "sobremesa",
        translation: "Zeit am Tisch nach dem Essen",
        partOfSpeech: "noun",
        pronunciation: "sobremesa",
        example: "Nos quedamos de sobremesa.",
      }),
    } as Response);

    render(<CardDesignTestScreen />);
    fireEvent.click(screen.getByTestId("randomize-card-button"));
    await waitFor(() => expect(screen.getByTestId("card-term")).toHaveTextContent("sobremesa"));
    fireEvent.click(screen.getByTestId("flip-card-button"));

    expect(screen.getByTestId("reference-card-back")).toHaveAttribute("lang", "de");
    expect(screen.queryByTestId("card-back-learning-language")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-back-native-language")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-back-flip-label")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-back-tier-label")).not.toBeInTheDocument();
  });

  it("marks a three-line example so the carved fox can be hidden", async () => {
    const threeLineSample = {
      cardId: "es-word-three-lines",
      learningLanguage: "es",
      nativeLanguage: "de",
      tier: "A1",
      term: "sobremesa",
      translation: "Zeit am Tisch nach dem Essen",
      partOfSpeech: "noun",
      pronunciation: "sobremesa",
      example: "Primera línea.\nSegunda línea.\nTercera línea.",
    };
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => threeLineSample,
    } as Response);

    render(<CardDesignTestScreen />);
    fireEvent.click(screen.getByTestId("randomize-card-button"));

    await waitFor(() => expect(screen.getByTestId("card-reference-example")).toHaveTextContent("Tercera línea."));
    expect(screen.getByTestId("reference-card")).toHaveAttribute("data-example-line-count", "3");
    expect(screen.getByTestId("fox-carved-mark")).toHaveAttribute("hidden");
    expect(screen.getByTestId("fox-carved-mark")).toHaveStyle({ display: "none" });
    expect(screen.getByTestId("fox-carved-mark")).toHaveClass("fd-card-design__front-fox");
    expect(screen.getByTestId("card-reference-example")).toHaveClass("fd-card-design__example");
  });

  it("updates the reference preview to an exact custom width and recalculates its ratio", () => {
    render(<CardDesignTestScreen />);

    const widthInput = screen.getByLabelText("Width (px)");
    fireEvent.change(widthInput, { target: { value: "420" } });
    fireEvent.blur(widthInput);

    expect(screen.getByTestId("card-preview-frame")).toHaveStyle({ width: "420px", height: "456px" });
    expect(screen.getByTestId("card-aspect-ratio")).toHaveTextContent("0.921");
  });

  it("resizes from a dragged corner while keeping the opposite corner anchored", () => {
    render(<CardDesignTestScreen />);

    const topRightHandle = screen.getByRole("button", { name: "Resize card from top right" });
    fireEvent.pointerDown(topRightHandle, { pointerId: 1, clientX: 100, clientY: 200 });
    fireEvent.pointerMove(topRightHandle, { pointerId: 1, clientX: 124, clientY: 184 });
    fireEvent.pointerUp(topRightHandle, { pointerId: 1 });

    expect(screen.getByTestId("card-preview-frame")).toHaveStyle({ width: "344px", height: "472px" });
    expect(screen.getByTestId("card-preview-frame")).toHaveStyle({
      transform: "translate(calc(-50% + 12px), calc(-50% + -8px))",
    });
  });
});

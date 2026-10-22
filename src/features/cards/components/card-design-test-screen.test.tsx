import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import * as cardSpeech from "@/features/cards/card-speech";
import { CardDesignTestScreen } from "@/features/cards/components/card-design-test-screen";

afterEach(() => vi.restoreAllMocks());

describe("CardDesignTestScreen", () => {
  it("shows the reference design details and four resize handles at the reference ratio", () => {
    render(<CardDesignTestScreen />);

    expect(screen.getByTestId("reference-card")).toBeInTheDocument();
    expect(screen.getByText("経済")).toBeVisible();
    expect(screen.getByText("economy")).toBeVisible();
    expect(screen.getByTestId("card-term")).toHaveClass("fd-card-design__term");
    expect(screen.getByTestId("card-translation")).toHaveClass("fd-card-design__translation");
    expect(screen.getByTestId("card-reference-example")).toHaveClass("fd-card-design__example");
    expect(screen.getByTestId("card-term").querySelector("[data-single-line-fit-content]")).toHaveClass("whitespace-nowrap");
    expect(screen.getByTestId("card-translation").querySelector("[data-single-line-fit-content]")).toHaveClass("whitespace-nowrap");
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
    expect(screen.getByTestId("card-tier-badge")).toHaveClass("h-[68px]", "w-[68px]", "font-super-water");
    expect(screen.getByTestId("card-front-glass-outline")).toHaveAttribute("stroke", "#b163ff");
    expect(screen.getByTestId("card-preview-canvas")).toHaveStyle({ backgroundColor: "rgb(0, 0, 0)" });
    expect(screen.getByTestId("card-preview-frame")).toHaveStyle({ width: "320px", height: "456px" });
    expect(screen.getByTestId("card-aspect-ratio")).toHaveTextContent("0.702");
    expect(screen.getAllByRole("button", { name: /^Resize card from/ })).toHaveLength(4);
    expect(screen.getByTestId("card-learning-language")).toHaveAttribute("data-language", "ja");
    expect(screen.getByTestId("card-native-language")).toHaveAttribute("data-language", "en");
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
    expect(screen.getByTestId("card-back-tier-text")).toHaveClass("font-super-water", "top-[7px]");
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

  it("keeps the fox mark behind a three-line example sentence", async () => {
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
    expect(screen.getByTestId("fox-carved-mark")).toBeInTheDocument();
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

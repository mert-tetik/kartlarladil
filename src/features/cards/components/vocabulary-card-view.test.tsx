import { render, screen } from "@testing-library/react";
import type { FormEvent, ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { getCardTranslation, getCardTranslationMeanings } from "@/features/cards/card-localization";
import { LocaleProvider } from "@/i18n/locale-provider";

const mockOpenAsk = vi.fn();

vi.mock("@/features/ask/components/ask-overlay-provider", () => ({
  useAskOverlay: () => ({ openAsk: mockOpenAsk }),
}));

vi.mock("@/features/auth/auth-client", () => ({
  useRequireAuthAction: () => (action: () => void) => action(),
}));

const testCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.tier === "A1")!;

afterEach(() => {
  vi.unstubAllGlobals();
  mockOpenAsk.mockReset();
});

describe("VocabularyCardView", () => {
  it("renders the front face by default", () => {
    const { container } = renderCard(<VocabularyCardView card={testCard} />);

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "front");
    expect(screen.getByRole("heading", { name: testCard.term })).toBeVisible();
    expect(screen.getByTestId("card-tier-badge")).toBeVisible();
    expect(screen.getByTestId("reference-card").querySelector("[data-card-progress]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-score-icon]")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: `${testCard.term}: Çevirmek için tıkla` })).not.toBeInTheDocument();
  });

  it("keeps the mobile card frame sized when callers use auto height", () => {
    const { container } = renderCard(
      <VocabularyCardView
        card={testCard}
        className="h-auto w-full max-w-[230px] max-sm:min-h-[300px]"
      />,
    );

    expect(container.firstElementChild).toHaveClass("h-auto", "aspect-[3/4]", "max-sm:aspect-[3/4]");
  });

  it("can start on the card back and reveal the front on click", async () => {
    const user = userEvent.setup();

    const { container } = renderCard(<VocabularyCardView card={testCard} initialFace="back" flippable />);

    const flipTarget = screen.getByRole("button", { name: `${testCard.term}: Çevirmek için tıkla` });

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "back");
    expect(container.querySelector('[data-card-back-tier="A1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="card-back-tier-circle"]')).toHaveTextContent("A1");
    expect(flipTarget).toHaveAttribute("aria-label", `${testCard.term}: Çevirmek için tıkla`);
    expect(screen.queryByRole("heading", { name: testCard.term })).not.toBeInTheDocument();

    await user.click(flipTarget);

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "front");
    expect(screen.getByRole("heading", { name: testCard.term })).toBeVisible();
  });

  it("can override the displayed tier on the card back", () => {
    const { container } = renderCard(<VocabularyCardView card={testCard} initialFace="back" backDisplayTier="C1" />);

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "back");
    expect(container.querySelector('[data-card-back-tier="C1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="card-back-tier-circle"]')).toHaveTextContent("C1");
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("reveals the front with the %s key", async (_label, keyCommand) => {
    const user = userEvent.setup();

    const { container } = renderCard(<VocabularyCardView card={testCard} initialFace="back" flippable />);

    screen.getByRole("button", { name: `${testCard.term}: Çevirmek için tıkla` }).focus();
    await user.keyboard(keyCommand);

    expect(container.firstElementChild).toHaveAttribute("data-card-face", "front");
    expect(screen.getByRole("heading", { name: testCard.term })).toBeVisible();
  });

  it("keeps card action buttons from triggering card flip behavior", async () => {
    const user = userEvent.setup();
    const addCard = vi.fn();

    const { container } = renderCard(<VocabularyCardView card={testCard} flippable onAdd={addCard} />);

    await user.click(screen.getByRole("button", { name: "Ekle" }));

    expect(addCard).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-tutorial-target="card-add"]')).toHaveAttribute("type", "button");
    expect(container.firstElementChild).toHaveAttribute("data-card-face", "front");
    expect(container.querySelector("[data-card-actions]")?.querySelectorAll("button")).toHaveLength(1);
    expect(container.querySelector('[data-tutorial-target="card-add"]')).toBeVisible();
  });

  it("does not submit a surrounding form when adding a card", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());

    renderCard(
      <form onSubmit={submit}>
        <VocabularyCardView card={testCard} onAdd={vi.fn()} />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Ekle" }));

    expect(submit).not.toHaveBeenCalled();
  });

  it("shows a supplied already-owned label and disables the add action", () => {
    renderCard(
      <VocabularyCardView
        card={testCard}
        owned
        ownedLabel="Kart zaten destede"
        onAdd={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Kart zaten destede" })).toBeDisabled();
  });

  it("uses the first example sentence as a single-line preview", () => {
    const { container } = renderCard(<VocabularyCardView card={testCard} />);
    const examplePreview = screen.getByText(testCard.examples[0]!.sentence);

    expect(examplePreview).toBeVisible();
    expect(examplePreview).toHaveClass("fd-card-design__example");
    expect(container).not.toHaveTextContent("is useful in a clear sentence");
    expect(container).toHaveTextContent(getCardTranslation(testCard, "tr"));
  });

  it("always keeps pronunciation and example visible in compact card views", () => {
    renderCard(<VocabularyCardView card={testCard} compact />);

    expect(screen.getByTestId("reference-card")).toBeInTheDocument();
    expect(screen.getByTestId("card-tier-badge")).toBeInTheDocument();
    expect(screen.getByTestId("card-pronunciation")).toBeVisible();
    expect(screen.getByTestId("card-reference-example")).toBeVisible();
  });

  it("shows the complete shared card face and owned-card progress without a regional hide mode", () => {
    const { container } = renderCard(
      <VocabularyCardView
        card={testCard}
        inventory={{
          cardId: testCard.id,
          status: "active",
          correctCount: 1,
          addedAt: "2026-07-19T00:00:00.000Z",
        }}
      />,
    );

    expect(container.querySelector("[data-card-progress]")).toHaveTextContent("1/4");
    expect(screen.getByTestId("card-pronunciation")).toBeVisible();
    expect(screen.getByTestId("card-reference-example")).toBeVisible();
  });

  it("shows supplied quiz progress with the standard card face", () => {
    const { container } = renderCard(
      <VocabularyCardView
        card={testCard}
        inventory={{
          cardId: testCard.id,
          status: "active",
          correctCount: 1,
          addedAt: "2026-07-19T00:00:00.000Z",
        }}
        footerProgressCount={2}
        progressAnimationActive
      />,
    );

    expect(container.querySelector("[data-card-progress]")).toHaveTextContent("2/4");
    expect(container.querySelector("[data-card-progress][role='progressbar']")).toHaveAttribute("aria-valuenow", "2");
    expect(container.querySelector("[data-card-progress]")).toHaveAttribute("data-progress-animation-active", "true");
    expect(container.querySelector("[data-card-progress] [data-progress-indicator-overlay]")).toBeInTheDocument();
  });

  it("opens the ask overlay with the card language and term", async () => {
    const user = userEvent.setup();

    renderCard(<VocabularyCardView card={testCard} />);
    await user.click(screen.getByRole("button", { name: `${testCard.term} Sor` }));

    expect(mockOpenAsk).toHaveBeenCalledWith({
      contextLanguage: testCard.language,
      initialTerm: testCard.term,
    });
  });

  it("speaks the card term with the card language when the speaker button is pressed", async () => {
    const user = userEvent.setup();
    const speak = vi.fn();
    const cancel = vi.fn();

    class MockSpeechSynthesisUtterance {
      lang = "";
      rate = 1;
      voice: SpeechSynthesisVoice | null = null;

      constructor(public text: string) {}
    }

    vi.stubGlobal("SpeechSynthesisUtterance", MockSpeechSynthesisUtterance);
    vi.stubGlobal("speechSynthesis", {
      cancel,
      getVoices: vi.fn(() => [{ lang: "en-US" }]),
      speak,
    });

    renderCard(<VocabularyCardView card={testCard} />);
    await user.click(screen.getByRole("button", { name: `Listen to ${testCard.term}` }));

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);

    const utterance = speak.mock.calls[0]![0] as SpeechSynthesisUtterance;

    expect(utterance.text).toBe(testCard.term);
    expect(utterance.lang).toBe("en-US");
    expect(utterance.rate).toBe(0.9);
  });

  it("does not bubble a pronunciation click into a controlled card action", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderCard(<VocabularyCardView card={testCard} face="front" onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: `Listen to ${testCard.term}` }));

    expect(onClick).not.toHaveBeenCalled();
  });
});

function renderCard(ui: ReactElement) {
  return render(<LocaleProvider initialLocale="tr">{ui}</LocaleProvider>);
}

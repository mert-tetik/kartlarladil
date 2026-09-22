import { fireEvent, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { BonusQuestionView } from "@/features/quiz/components/bonus-question-view";
import { speakCardTerm } from "@/features/cards/card-speech";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

vi.mock("@/features/cards/card-speech", () => ({
  speakCardTerm: vi.fn(),
}));

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
}));

vi.mock("@/lib/vibration", () => ({
  vibrate: vi.fn(),
}));

describe("BonusQuestionView", () => {
  const matchingQuestion = {
    kind: "matching" as const,
    pairs: [
      { id: "a", cardId: "card-a", term: "apple", meaning: "elma" },
      { id: "b", cardId: "card-b", term: "book", meaning: "kitap" },
      { id: "c", cardId: "card-c", term: "chair", meaning: "sandalye" },
      { id: "d", cardId: "card-d", term: "door", meaning: "kapı" },
    ],
    terms: [
      { id: "a", cardId: "card-a", term: "apple", meaning: "elma" },
      { id: "b", cardId: "card-b", term: "book", meaning: "kitap" },
      { id: "c", cardId: "card-c", term: "chair", meaning: "sandalye" },
      { id: "d", cardId: "card-d", term: "door", meaning: "kapı" },
    ],
    meanings: [
      { id: "a", cardId: "card-a", term: "apple", meaning: "elma" },
      { id: "b", cardId: "card-b", term: "book", meaning: "kitap" },
      { id: "c", cardId: "card-c", term: "chair", meaning: "sandalye" },
      { id: "d", cardId: "card-d", term: "door", meaning: "kapı" },
    ],
  };

  it("does not show the reward HUD before the bonus reward is ready", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <BonusQuestionView
          question={matchingQuestion}
          showingAnswer
          answerAccepted
          totalPoints={42}
          rewardReady={false}
          showPointFlight={false}
          onSubmit={vi.fn()}
          onSkip={vi.fn()}
          onNext={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(container.querySelector("[data-bonus-reward-hud]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-bonus-reward-source]")).toHaveAttribute("data-bonus-reward-source-state", "idle");
    expect(container.querySelector("[data-bonus-reward-source] img")).not.toHaveClass("animate-bonus-reward-source-exit");
  });

  it("starts the source exit and keeps the reward HUD anchored to the source slot", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <BonusQuestionView
          question={matchingQuestion}
          showingAnswer
          answerAccepted
          rewardReady
          showPointFlight={false}
          gemRewards={[{ type: "blue", amount: 2 }]}
          gemBalances={{ blue: 4, green: 0, purple: 0 }}
          onSubmit={vi.fn()}
          onSkip={vi.fn()}
          onNext={vi.fn()}
        />
      </LocaleProvider>,
    );

    const source = container.querySelector("[data-bonus-reward-source]");
    const sourceImage = source?.querySelector("img");
    const rewardHud = source?.querySelector("[data-bonus-reward-hud]");

    expect(source).toHaveAttribute("data-bonus-reward-source-state", "exiting");
    expect(sourceImage).toHaveClass("animate-bonus-reward-source-exit");
    expect(rewardHud).toBeInTheDocument();
    expect(rewardHud).toHaveClass("absolute");
    expect(rewardHud?.parentElement).toBe(source);
    expect(container.querySelector("[data-bonus-reward-score]")).toHaveTextContent("0");
    expect(container.querySelectorAll("[data-reward-gem-target]")).toHaveLength(3);
  });

  it("mounts the point flight icons after reward geometry is available", async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute("data-bonus-reward-source")) return { left: 120, top: 240, width: 160, height: 104 } as DOMRect;
      if (this.hasAttribute("data-bonus-reward-score")) return { left: 600, top: 32, width: 120, height: 48 } as DOMRect;
      if (this.hasAttribute("data-bonus-reward-flight-source")) return { left: 399.5, top: 899.5, width: 1, height: 1 } as DOMRect;
      return { left: 0, top: 0, width: 0, height: 0 } as DOMRect;
    });

    try {
      render(
        <StrictMode>
          <LocaleProvider initialLocale="en">
            <BonusQuestionView
              question={matchingQuestion}
              showingAnswer
              answerAccepted
              rewardReady
              showPointFlight
              gemRewards={[]}
              onSubmit={vi.fn()}
              onSkip={vi.fn()}
              onNext={vi.fn()}
            />
          </LocaleProvider>
        </StrictMode>,
      );

      await waitFor(() => {
        expect(document.body.querySelectorAll(".animate-quiz-score-icon-flight").length).toBeGreaterThan(0);
      });
      expect(document.body.querySelector("[data-bonus-reward-flight-source]")).toBeInTheDocument();
      expect(document.body.querySelector(".animate-quiz-score-icon-flight"))
        .toHaveStyle({ "--score-flight-start-x": "400px", "--score-flight-start-y": "900px" });
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("animates both buttons when a pair is formed", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <BonusQuestionView
          question={matchingQuestion}
          showingAnswer={false}
          answerAccepted={null}
          onSubmit={onSubmit}
          onSkip={vi.fn()}
          onNext={vi.fn()}
        />
      </LocaleProvider>,
    );

    const term = (id: string) => container.querySelector<HTMLButtonElement>(`[data-bonus-term="${id}"]`)!;
    const meaning = (id: string) => container.querySelector<HTMLButtonElement>(`[data-bonus-meaning="${id}"]`)!;

    fireEvent.click(meaning("a"));
    expect(meaning("a")).not.toHaveClass("ring-2", "ring-brand");
    expect(meaning("a").getAttribute("style")).toContain("border-color: var(--brand)");
    expect(term("a")).not.toHaveClass("ring-2", "ring-brand");
    fireEvent.click(meaning("b"));
    expect(meaning("a")).not.toHaveClass("ring-2", "ring-brand");
    expect(meaning("b")).not.toHaveClass("ring-2", "ring-brand");
    expect(meaning("b").getAttribute("style")).toContain("border-color: var(--brand)");
    expect(term("b")).not.toHaveClass("ring-2", "ring-brand");
    fireEvent.click(term("a"));
    await waitFor(() => {
      expect(term("a")).toHaveClass("animate-bonus-matching-pair-confirm");
      expect(meaning("b")).toHaveClass("animate-bonus-matching-pair-confirm");
      expect(term("b")).not.toHaveClass("animate-bonus-matching-pair-confirm");
    });
    expect(speakCardTerm).toHaveBeenCalledWith("apple", "en");
    expect(playSoundEffect).toHaveBeenCalledWith("bonus-select");

    fireEvent.click(meaning("a"));
    fireEvent.click(term("a"));
    fireEvent.click(meaning("b"));
    fireEvent.click(term("b"));
    fireEvent.click(meaning("c"));
    fireEvent.click(term("c"));
    fireEvent.click(meaning("d"));
    fireEvent.click(term("d"));

    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-bonus-check]")!);
    expect(onSubmit).toHaveBeenCalledWith("matching", true);
  });

  it("uses a light vibration for selection and a stronger vibration for correct or incorrect matches", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <BonusQuestionView
          question={matchingQuestion}
          showingAnswer={false}
          answerAccepted={null}
          onSubmit={vi.fn()}
          onSkip={vi.fn()}
          onNext={vi.fn()}
        />
      </LocaleProvider>,
    );

    const term = (id: string) => container.querySelector<HTMLButtonElement>(`[data-bonus-term="${id}"]`)!;
    const meaning = (id: string) => container.querySelector<HTMLButtonElement>(`[data-bonus-meaning="${id}"]`)!;

    fireEvent.click(term("a"));
    expect(vibrate).toHaveBeenLastCalledWith("tap");

    vi.mocked(vibrate).mockClear();
    fireEvent.click(meaning("a"));
    expect(vibrate).toHaveBeenLastCalledWith("correct");

    vi.mocked(vibrate).mockClear();
    fireEvent.click(term("b"));
    expect(vibrate).toHaveBeenLastCalledWith("tap");

    vi.mocked(vibrate).mockClear();
    fireEvent.click(meaning("c"));
    expect(vibrate).toHaveBeenLastCalledWith("incorrect");
  });

  it("colors matching buttons by correctness after checking", async () => {
    const { container, rerender } = render(
      <LocaleProvider initialLocale="en">
        <BonusQuestionView
          question={matchingQuestion}
          showingAnswer={false}
          answerAccepted={null}
          onSubmit={vi.fn()}
          onSkip={vi.fn()}
          onNext={vi.fn()}
        />
      </LocaleProvider>,
    );

    const term = (id: string) => container.querySelector<HTMLButtonElement>(`[data-bonus-term="${id}"]`)!;
    const meaning = (id: string) => container.querySelector<HTMLButtonElement>(`[data-bonus-meaning="${id}"]`)!;

    fireEvent.click(term("a"));
    fireEvent.click(meaning("b"));
    fireEvent.click(term("b"));
    fireEvent.click(meaning("a"));
    fireEvent.click(term("c"));
    fireEvent.click(meaning("c"));
    fireEvent.click(term("d"));
    fireEvent.click(meaning("d"));

    rerender(
      <LocaleProvider initialLocale="en">
        <BonusQuestionView
          question={matchingQuestion}
          showingAnswer
          answerAccepted={false}
          onSubmit={vi.fn()}
          onSkip={vi.fn()}
          onNext={vi.fn()}
        />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(term("a")).toHaveAttribute("data-bonus-result", "incorrect");
      expect(meaning("b")).toHaveAttribute("data-bonus-result", "incorrect");
      expect(term("c")).toHaveAttribute("data-bonus-result", "correct");
      expect(meaning("c")).toHaveAttribute("data-bonus-result", "correct");
    });

    expect(container.querySelector("[data-bonus-matching-connections]")).not.toBeInTheDocument();
    expect(term("a")).toHaveAttribute("data-bonus-result", "incorrect");
    expect(term("a")).toHaveTextContent("(elma)");
    expect(term("a").querySelector('[data-bonus-correct-answer="a"]')).toHaveAttribute("aria-hidden", "false");
    expect(term("c").querySelector('[data-bonus-correct-answer="c"]')).toHaveAttribute("aria-hidden", "true");
    expect(term("a")).toHaveClass("h-14");
  });

  it("allows a matching pair to be replaced before checking", () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <BonusQuestionView
          question={{
            kind: "matching",
            pairs: [
              { id: "a", cardId: "card-a", term: "apple", meaning: "elma" },
              { id: "b", cardId: "card-b", term: "book", meaning: "kitap" },
              { id: "c", cardId: "card-c", term: "chair", meaning: "sandalye" },
              { id: "d", cardId: "card-d", term: "door", meaning: "kapı" },
            ],
            terms: [
              { id: "a", cardId: "card-a", term: "apple", meaning: "elma" },
              { id: "b", cardId: "card-b", term: "book", meaning: "kitap" },
              { id: "c", cardId: "card-c", term: "chair", meaning: "sandalye" },
              { id: "d", cardId: "card-d", term: "door", meaning: "kapı" },
            ],
            meanings: [
              { id: "a", cardId: "card-a", term: "apple", meaning: "elma" },
              { id: "b", cardId: "card-b", term: "book", meaning: "kitap" },
              { id: "c", cardId: "card-c", term: "chair", meaning: "sandalye" },
              { id: "d", cardId: "card-d", term: "door", meaning: "kapı" },
            ],
          }}
          showingAnswer={false}
          answerAccepted={null}
          onSubmit={onSubmit}
          onSkip={vi.fn()}
          onNext={vi.fn()}
        />
      </LocaleProvider>,
    );

    const term = (id: string) => container.querySelector<HTMLButtonElement>(`[data-bonus-term="${id}"]`)!;
    const meaning = (id: string) => container.querySelector<HTMLButtonElement>(`[data-bonus-meaning="${id}"]`)!;

    fireEvent.click(term("a"));
    fireEvent.click(meaning("a"));
    fireEvent.click(term("a"));
    fireEvent.click(meaning("b"));
    fireEvent.click(term("b"));
    fireEvent.click(meaning("a"));
    fireEvent.click(term("c"));
    fireEvent.click(meaning("c"));
    fireEvent.click(term("d"));
    fireEvent.click(meaning("d"));

    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-bonus-check]")!);
    expect(onSubmit).toHaveBeenCalledWith("matching", false);
  });

  it("lets sentence tokens be removed from the sentence before checking", () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <BonusQuestionView
          question={{
            kind: "sentence-order",
            sentence: "I learn",
            sourceCardId: "card-a",
            acceptedTokenOrders: [["one", "two"]],
            tokens: [
              { id: "one", text: "I" },
              { id: "two", text: "learn" },
            ],
          }}
          showingAnswer={false}
          answerAccepted={null}
          onSubmit={onSubmit}
          onSkip={vi.fn()}
          onNext={vi.fn()}
        />
      </LocaleProvider>,
    );

    const token = (id: string) => container.querySelector<HTMLButtonElement>(`[data-bonus-sentence-token="${id}"]`)!;
    expect(document.body.querySelector("[data-bonus-sentence-decoration]")).toBeInTheDocument();
    fireEvent.click(token("one"));
    const selectedToken = container.querySelector("[data-bonus-sentence-selected=\"one\"]");
    expect(selectedToken).toBeInTheDocument();
    expect(selectedToken).toHaveClass("bg-brand", "border-[3px]", "border-b-[6px]");
    expect(selectedToken).not.toHaveClass("border-brand");
    fireEvent.click(token("one"));
    expect(container.querySelector("[data-bonus-sentence-selected=\"one\"]")).not.toBeInTheDocument();

    fireEvent.click(token("one"));
    fireEvent.click(token("two"));
    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-bonus-check]")!);
    expect(onSubmit).toHaveBeenCalledWith("sentence-order", true);
  });

  it("animates category words and requires a second tap to select a returned word", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <BonusQuestionView
          question={{
            kind: "category-sort",
            words: [
              { id: "apple", cardId: "apple", text: "apple" },
              { id: "car", cardId: "car", text: "car" },
              { id: "blue", cardId: "blue", text: "blue" },
            ],
            categories: [
              { id: "fruit", name: "Fruit", wordIds: ["apple"] },
              { id: "transport", name: "Transport", wordIds: ["car"] },
              { id: "color", name: "Color", wordIds: ["blue"] },
            ],
          }}
          showingAnswer={false}
          answerAccepted={null}
          onSubmit={vi.fn()}
          onSkip={vi.fn()}
          onNext={vi.fn()}
        />
      </LocaleProvider>,
    );

    const word = (id: string) => container.querySelector<HTMLButtonElement>(`[data-bonus-category-word="${id}"]`)!;
    const category = (id: string) => container.querySelector<HTMLElement>(`[data-bonus-category="${id}"]`)!;

    fireEvent.click(word("apple"));
    fireEvent.click(category("fruit"));
    expect(word("apple")).toHaveClass("bg-emerald-500", "border-[3px]", "border-b-[6px]");
    expect(container.querySelector("[data-bonus-category-assigned-word=\"apple\"]")).toHaveClass("animate-bonus-category-word-enter");

    fireEvent.click(word("apple"));
    expect(container.querySelector("[data-bonus-category-assigned-word=\"apple\"]")).toHaveClass("animate-bonus-category-word-exit");
    expect(word("apple")).not.toHaveClass("ring-brand");

    fireEvent.click(word("apple"));
    fireEvent.click(category("transport"));
    expect(container.querySelector("[data-bonus-category-assigned-word=\"apple\"]")).toBeInTheDocument();
  });

  it("exposes a skip action alongside bonus question checks", () => {
    const onSkip = vi.fn();
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <BonusQuestionView
          question={{
            kind: "matching",
            pairs: [
              { id: "a", cardId: "card-a", term: "apple", meaning: "elma" },
              { id: "b", cardId: "card-b", term: "book", meaning: "kitap" },
              { id: "c", cardId: "card-c", term: "chair", meaning: "sandalye" },
              { id: "d", cardId: "card-d", term: "door", meaning: "kapÄ±" },
            ],
            terms: [
              { id: "a", cardId: "card-a", term: "apple", meaning: "elma" },
              { id: "b", cardId: "card-b", term: "book", meaning: "kitap" },
              { id: "c", cardId: "card-c", term: "chair", meaning: "sandalye" },
              { id: "d", cardId: "card-d", term: "door", meaning: "kapÄ±" },
            ],
            meanings: [
              { id: "a", cardId: "card-a", term: "apple", meaning: "elma" },
              { id: "b", cardId: "card-b", term: "book", meaning: "kitap" },
              { id: "c", cardId: "card-c", term: "chair", meaning: "sandalye" },
              { id: "d", cardId: "card-d", term: "door", meaning: "kapÄ±" },
            ],
          }}
          showingAnswer={false}
          answerAccepted={null}
          onSubmit={vi.fn()}
          onSkip={onSkip}
          onNext={vi.fn()}
        />
      </LocaleProvider>,
    );

    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-quiz-skip]")!);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("marks every matching button as incorrect when skipped", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <BonusQuestionView
          question={matchingQuestion}
          showingAnswer
          answerAccepted={false}
          wasSkipped
          onSubmit={vi.fn()}
          onSkip={vi.fn()}
          onNext={vi.fn()}
        />
      </LocaleProvider>,
    );

    expect(container.querySelectorAll('[data-bonus-result="incorrect"]')).toHaveLength(8);
    expect(container.querySelectorAll(".animate-bonus-incorrect-shake")).toHaveLength(8);
  });
});

import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { BonusQuestionView } from "@/features/quiz/components/bonus-question-view";

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

  it("allows matching from either column and replaces a pending same-column selection", () => {
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
    fireEvent.click(meaning("b"));
    fireEvent.click(term("b"));
    fireEvent.click(meaning("a"));
    fireEvent.click(term("a"));
    fireEvent.click(meaning("c"));
    fireEvent.click(term("c"));
    fireEvent.click(meaning("d"));
    fireEvent.click(term("d"));

    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-bonus-check]")!);
    expect(onSubmit).toHaveBeenCalledWith("matching", true);
  });

  it("colors matching lines and both buttons by correctness after checking", async () => {
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
      expect(container.querySelector('[data-bonus-matching-connection="a-b"]')).toHaveAttribute("stroke", "#ef4444");
      expect(container.querySelector('[data-bonus-matching-connection="c-c"]')).toHaveAttribute("stroke", "#22c55e");
    });
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
    expect(container.querySelector("[data-bonus-sentence-decoration]")).toBeInTheDocument();
    fireEvent.click(token("one"));
    const selectedToken = container.querySelector("[data-bonus-sentence-selected=\"one\"]");
    expect(selectedToken).toBeInTheDocument();
    expect(selectedToken).toHaveClass("bg-brand", "border-0");
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
              { id: "apple", text: "apple" },
              { id: "car", text: "car" },
              { id: "blue", text: "blue" },
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
    expect(word("apple")).toHaveClass("bg-emerald-500", "border-0");
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
});

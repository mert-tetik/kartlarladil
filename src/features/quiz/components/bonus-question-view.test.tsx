import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { BonusQuestionView } from "@/features/quiz/components/bonus-question-view";

describe("BonusQuestionView", () => {
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
    fireEvent.click(token("one"));
    expect(container.querySelector("[data-bonus-sentence-selected=\"one\"]")).toBeInTheDocument();
    fireEvent.click(token("one"));
    expect(container.querySelector("[data-bonus-sentence-selected=\"one\"]")).not.toBeInTheDocument();

    fireEvent.click(token("one"));
    fireEvent.click(token("two"));
    fireEvent.click(container.querySelector<HTMLButtonElement>("[data-bonus-check]")!);
    expect(onSubmit).toHaveBeenCalledWith("sentence-order", true);
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

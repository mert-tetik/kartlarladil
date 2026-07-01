import { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { EMPTY_PROGRESS_STATS } from "@/features/progress/progress-stats";
import { MobileQuizFeedback, QuizStation, ResultView } from "@/features/quiz/components/quiz-station";
import { LocaleProvider } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import { LOCALE_COOKIE_NAME } from "@/i18n/config";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { InventoryCard, LocaleCode } from "@/types/domain";

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = `${LOCALE_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/learn",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/features/inventory/cloud-actions", () => ({
  addCloudInventoryCardAction: vi.fn(),
  listCloudInventoryAction: vi.fn(),
  migrateLocalInventoryToCloudAction: vi.fn(),
  recordCloudPracticeAttemptAction: vi.fn(),
  resetCloudInventoryAction: vi.fn(),
}));

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
}));

vi.mock("@/features/progress/progress-client", () => ({
  useProgressStats: () => ({ refreshStats: vi.fn(), stats: EMPTY_PROGRESS_STATS }),
}));

vi.mock("@/features/quiz/components/quiz-start-splash", () => ({
  QuizStartSplash: ({ onComplete }: { onComplete: () => void }) => {
    useEffect(() => {
      onComplete();
    }, [onComplete]);
    return null;
  },
}));

vi.mock("@/features/quiz/components/quiz-streak-celebration-view", () => ({
  QuizStreakCelebrationView: ({ streak }: { streak: number }) => (
    <div data-streak-celebration-view data-streak-count={streak}>
      {streak}
    </div>
  ),
}));

const testUser: AuthShellUser = {
  id: "user-1",
  email: "test@example.com",
  profile: {
    displayName: "Test User",
    preferredLanguageCode: "en",
    preferredUiLocale: "tr",
    preferredTier: "A1",
  onboardingCompleted: true,
    aiPracticePoints: 0,
    chestPoints: 0,
  },
};

const testCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.tier === "A1")!;
const germanCard = VOCABULARY_CARDS.find((card) => card.language === "de" && card.tier === "A1")!;
const correctAnswer = getPrimaryCardTranslation(testCard, "tr");

const inventoryCard: InventoryCard = {
  cardId: testCard.id,
  status: "active",
  correctCount: 0,
  addedAt: "2026-06-09T00:00:00.000Z",
};

describe("MobileQuizFeedback", () => {
  it("keeps the previous content while closing so the next card does not flash the old color", () => {
    const onNext = vi.fn();
    const { rerender, container } = render(
      <LocaleProvider initialLocale="en">
        <MobileQuizFeedback isOpen={true} isCorrect={false} correctAnswer="apple" onNext={onNext} />
      </LocaleProvider>,
    );

    const bar = container.querySelector("[data-quiz-mobile-feedback] > div");
    expect(bar).toHaveClass("bg-rose-500");
    expect(screen.getByText(/apple/i)).toBeInTheDocument();

    // Simulate the next card starting to open while the sheet is still closing.
    rerender(
      <LocaleProvider initialLocale="en">
        <MobileQuizFeedback isOpen={false} isCorrect={true} correctAnswer="banana" onNext={onNext} />
      </LocaleProvider>,
    );

    // The snapshot from the previous open state should still be rendered.
    expect(bar).toHaveClass("bg-rose-500");
    expect(screen.getByText(/apple/i)).toBeInTheDocument();

    // Once the sheet opens again it should reflect the new answer.
    rerender(
      <LocaleProvider initialLocale="en">
        <MobileQuizFeedback isOpen={true} isCorrect={true} correctAnswer="banana" onNext={onNext} />
      </LocaleProvider>,
    );

    const newBar = container.querySelector("[data-quiz-mobile-feedback] > div");
    expect(newBar).toHaveClass("bg-emerald-500");
    expect(screen.queryByText(/apple/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Correct answer/i)).toBeInTheDocument();
  });
});

describe("ResultView star rating", () => {
  function renderResultView(correctCount: number, incorrectCount: number, learnedCount = 0) {
    const correctCards = VOCABULARY_CARDS.slice(0, correctCount);
    const incorrectCards = VOCABULARY_CARDS.slice(correctCount, correctCount + incorrectCount);
    const learnedCards = VOCABULARY_CARDS.slice(
      correctCount + incorrectCount,
      correctCount + incorrectCount + learnedCount,
    );

    render(
      <LocaleProvider initialLocale="tr">
        <ResultView
          mode="active"
          results={{ correct: correctCards, incorrect: incorrectCards, learned: learnedCards }}
          selectedCount={10}
          chestOpened={false}
          onRestart={vi.fn()}
          onExit={vi.fn()}
        />
      </LocaleProvider>,
    );
  }

  it("shows 5 filled stars for 100% accuracy", () => {
    renderResultView(10, 0);
    expect(document.querySelector('[data-quiz-star-rating-value="5"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-quiz-star="filled"]')).toHaveLength(5);
  });

  it("shows 4 filled stars for 80% accuracy", () => {
    renderResultView(8, 2);
    expect(document.querySelector('[data-quiz-star-rating-value="4"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-quiz-star="filled"]')).toHaveLength(4);
    expect(document.querySelectorAll('[data-quiz-star="empty"]')).toHaveLength(1);
  });

  it("shows 3 filled stars for 70% accuracy", () => {
    renderResultView(7, 3);
    expect(document.querySelector('[data-quiz-star-rating-value="3"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-quiz-star="filled"]')).toHaveLength(3);
  });

  it("shows 2 filled stars for 50% accuracy", () => {
    renderResultView(5, 5);
    expect(document.querySelector('[data-quiz-star-rating-value="2"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-quiz-star="filled"]')).toHaveLength(2);
  });

  it("shows 1 filled star for 0% accuracy", () => {
    renderResultView(0, 5);
    expect(document.querySelector('[data-quiz-star-rating-value="1"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-quiz-star="filled"]')).toHaveLength(1);
  });
});

describe("QuizStation streak celebration", () => {
  function getCurrentCard(cards: typeof VOCABULARY_CARDS) {
    const term = document.querySelector("[data-quiz-card-term]")?.getAttribute("data-quiz-card-term");
    return cards.find((card) => card.term === term);
  }

  async function answerCurrentCardCorrectly(cards: typeof VOCABULARY_CARDS) {
    const card = getCurrentCard(cards);
    expect(card).toBeDefined();
    const answer = getPrimaryCardTranslation(card!, "tr");
    fireEvent.click(screen.getByRole("button", { name: answer }));
  }

  it("shows a streak celebration after 5 consecutive correct answers", async () => {
    const englishCards = VOCABULARY_CARDS.filter(
      (card) => card.language === "en" && card.tier === "A1",
    ).slice(0, 6);

    useInventoryStore.setState({
      cards: englishCards.map((card) => ({
        cardId: card.id,
        status: "active",
        correctCount: 0,
        addedAt: "2026-06-09T00:00:00.000Z",
      })),
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });

    renderQuizStation();
    fireEvent.click(screen.getByRole("button", { name: /English|Ä°ngilizce/i }));

    await waitFor(() => {
      expect(getCurrentCard(englishCards)).toBeDefined();
    });

    for (let index = 0; index < 4; index += 1) {
      await answerCurrentCardCorrectly(englishCards);
      const nextButton = await waitFor(() => {
        const button = document.querySelector<HTMLElement>("[data-quiz-next-button]");
        expect(button).toBeEnabled();
        return button!;
      });
      fireEvent.click(nextButton);
      if (index < 3) {
        await waitFor(() => {
          expect(document.querySelector("[data-streak-celebration-view]")).not.toBeInTheDocument();
        });
      }
    }

    await answerCurrentCardCorrectly(englishCards);

    await waitFor(() => {
      expect(document.querySelector("[data-streak-celebration-view]")).toBeInTheDocument();
    });
    expect(document.querySelector("[data-streak-count]")).toHaveAttribute("data-streak-count", "5");
  });

  it("resets the streak after an incorrect answer", async () => {
    const englishCards = VOCABULARY_CARDS.filter(
      (card) => card.language === "en" && card.tier === "A1",
    ).slice(0, 6);

    useInventoryStore.setState({
      cards: englishCards.map((card) => ({
        cardId: card.id,
        status: "active",
        correctCount: 0,
        addedAt: "2026-06-09T00:00:00.000Z",
      })),
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });

    renderQuizStation();
    fireEvent.click(screen.getByRole("button", { name: /English|Ä°ngilizce/i }));

    await waitFor(() => {
      expect(getCurrentCard(englishCards)).toBeDefined();
    });

    for (let index = 0; index < 4; index += 1) {
      await answerCurrentCardCorrectly(englishCards);
      const nextButton = await waitFor(() => {
        const button = document.querySelector<HTMLElement>("[data-quiz-next-button]");
        expect(button).toBeEnabled();
        return button!;
      });
      fireEvent.click(nextButton);
    }

    const currentCard = getCurrentCard(englishCards);
    expect(currentCard).toBeDefined();
    const wrongOption = Array.from(document.querySelectorAll("[data-quiz-option]")).find(
      (button) => button.textContent?.trim() !== getPrimaryCardTranslation(currentCard!, "tr"),
    );
    expect(wrongOption).toBeDefined();
    fireEvent.click(wrongOption!);

    await waitFor(() => {
      expect(document.querySelector("[data-streak-celebration-view]")).not.toBeInTheDocument();
    });
  });
});
describe("QuizStation sound feedback", () => {
  beforeEach(() => {
    useInventoryStore.setState({
      cards: [inventoryCard],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });
    vi.clearAllMocks();
  });

  it("plays the correct-answer effect after a correct guess", async () => {
    renderQuizStation();
    await startChoiceQuiz();
    fireEvent.click(screen.getByRole("button", { name: correctAnswer }));

    expect(playSoundEffect).toHaveBeenCalledWith("correct");
  });

  it("plays the incorrect-answer effect after a wrong guess", async () => {
    renderQuizStation();
    await startChoiceQuiz();

    const wrongOption = Array.from(document.querySelectorAll("[data-quiz-option]")).find(
      (button) => button.textContent?.trim() !== correctAnswer,
    );

    expect(wrongOption).toBeDefined();
    fireEvent.click(wrongOption!);

    expect(playSoundEffect).toHaveBeenCalledWith("incorrect");
  });

  it("orders the mobile choice quiz as prompt, card, then question", async () => {
    renderQuizStation();
    await startChoiceQuiz();

    const layout = document.querySelector('[data-quiz-mobile-layout="choice"]');
    const prompt = layout?.querySelector("[data-quiz-mobile-prompt]");
    const cardSlot = layout?.querySelector("[data-quiz-mobile-card-slot]");
    const card = layout?.querySelector("[data-quiz-mobile-card]");
    const question = layout?.querySelector("[data-quiz-mobile-question]");

    expect(prompt).toHaveClass("order-1");
    expect(cardSlot).toHaveClass("order-2");
    expect(question).toHaveClass("order-3");
    expect(card).toHaveClass("w-[min(285px,calc((100vw-3rem)/2))]");
  });

  it("reserves the next-card slot before a choice answer is shown", async () => {
    renderQuizStation();
    await startChoiceQuiz();

    const slot = document.querySelector<HTMLElement>("[data-quiz-next-slot]");
    const nextButton = document.querySelector<HTMLElement>(
      "[data-quiz-next-button]",
    );

    expect(slot).toContainElement(nextButton);
    expect(nextButton).toHaveClass("invisible");
    expect(nextButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: correctAnswer }));

    expect(slot).toContainElement(nextButton);
    expect(nextButton).not.toHaveClass("invisible");
    expect(nextButton).toBeEnabled();
  });

  it("places the text-answer question above the card on mobile", async () => {
    useInventoryStore.setState({
      cards: [{ ...inventoryCard, correctCount: 3 }],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });

    renderQuizStation();
    fireEvent.click(screen.getByRole("button", { name: /English|Ä°ngilizce/i }));
    await screen.findByRole("textbox");

    const layout = document.querySelector('[data-quiz-mobile-layout="text"]');
    const cardSlot = layout?.querySelector("[data-quiz-mobile-card-slot]");
    const card = layout?.querySelector("[data-quiz-mobile-card]");
    const question = layout?.querySelector("[data-quiz-mobile-question]");

    expect(question).toHaveClass("order-1");
    expect(cardSlot).toHaveClass("order-2");
    expect(card).not.toHaveClass("origin-top", "scale-[1.12]");
  });

  it("does not show the mobile learning splash on the first text question", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    useInventoryStore.setState({
      cards: [{ ...inventoryCard, correctCount: 3 }],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });

    renderQuizStation();
    fireEvent.click(screen.getByRole("button", { name: /English|Ä°ngilizce/i }));
    await screen.findByRole("textbox");

    expect(document.querySelector("[data-learning-quiz-splash]")).not.toBeInTheDocument();

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
  });

  it("asks for a language before starting when multiple languages are available", async () => {
    useInventoryStore.setState({
      cards: [inventoryCard, { ...inventoryCard, cardId: germanCard.id }],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });

    renderQuizStation();

    expect(screen.getByRole("heading", { name: "Alıştırma dilini seç" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Almanca/ }));

    await screen.findByRole("heading", { name: germanCard.term });
  });

  it("does not list the current site language as a practice language", () => {
    useInventoryStore.setState({
      cards: [inventoryCard, { ...inventoryCard, cardId: germanCard.id }],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });

    renderQuizStation("en");

    expect(screen.getByRole("heading", { name: "Choose a practice language" })).toBeVisible();
    expect(screen.getByText("English is hidden because it's the site language.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /English/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /German/i })).toBeVisible();
  });

  it("auto-advances to the result screen when the learned-card limit blocks learning", async () => {
    const learnedCards = VOCABULARY_CARDS.filter((card) => card.id !== testCard.id)
      .slice(0, 50)
      .map<InventoryCard>((card, index) => ({
        cardId: card.id,
        status: "learned",
        correctCount: 4,
        addedAt: `2026-06-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        learnedAt: `2026-06-${String(index + 1).padStart(2, "0")}T01:00:00.000Z`,
      }));

    useInventoryStore.setState({
      cards: [
        {
          ...inventoryCard,
          correctCount: 3,
        },
        ...learnedCards,
      ],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });

    renderQuizStation("tr");
    fireEvent.click(screen.getByRole("button", { name: /English/i }));

    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: testCard.term } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByTestId("quiz-result-panel")).toBeVisible();
    });
  });

  it("does not call AI validation when the text answer is directly correct", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ accepted: true }) }),
    );
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);

    useInventoryStore.setState({
      cards: [{ ...inventoryCard, correctCount: 3 }],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });

    renderQuizStation("tr");
    fireEvent.click(screen.getByRole("button", { name: /English|Ä°ngilizce/i }));

    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: testCard.term } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(playSoundEffect).toHaveBeenCalledWith("correct");
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses AI validation for a wrong text answer when the free daily limit is available", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ accepted: true }) }),
    );
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);

    useInventoryStore.setState({
      cards: [{ ...inventoryCard, correctCount: 3 }],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });

    renderQuizStation("tr");
    fireEvent.click(screen.getByRole("button", { name: /English|Ä°ngilizce/i }));

    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "obviously wrong guess" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    expect(playSoundEffect).toHaveBeenCalledWith("correct");
  });

  it("falls back to incorrect when the free daily AI validation limit is exhausted", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ accepted: true }) }),
    );
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);

    window.localStorage.setItem(
      "foxiesdeck:ai-quiz-validation:daily",
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 15 }),
    );

    useInventoryStore.setState({
      cards: [{ ...inventoryCard, correctCount: 3 }],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });

    renderQuizStation("tr");
    fireEvent.click(screen.getByRole("button", { name: /English|Ä°ngilizce/i }));

    const input = await screen.findByRole("textbox");
    fireEvent.change(input, { target: { value: "wrong again" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(playSoundEffect).toHaveBeenCalledWith("incorrect");
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

function renderQuizStation(locale: LocaleCode = "tr") {
  render(
    <LocaleProvider initialLocale={locale}>
      <AuthSessionProvider user={testUser}>
        <QuizStation mode="active" />
      </AuthSessionProvider>
    </LocaleProvider>,
  );
}

async function startChoiceQuiz() {
  fireEvent.click(screen.getByRole("button", { name: /English|İngilizce/i }));
  await screen.findByRole("heading", { name: testCard.term });
}

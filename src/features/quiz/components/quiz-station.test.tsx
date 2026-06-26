import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { MobileQuizFeedback, QuizStation } from "@/features/quiz/components/quiz-station";
import { LocaleProvider } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { InventoryCard, LocaleCode } from "@/types/domain";

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
  useProgressStats: () => ({ refreshStats: vi.fn() }),
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

  it("renders the mobile learning splash against the viewport body", async () => {
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

    const splash = document.querySelector("[data-learning-quiz-splash]");

    expect(splash?.parentElement).toBe(document.body);
    expect(splash).toHaveClass("fixed", "inset-0", "z-[60]");

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
      expect(screen.getByRole("heading", { name: "Alıştırma sonucu" })).toBeVisible();
    });
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

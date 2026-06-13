import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { getCardTranslation } from "@/features/cards/card-localization";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { QuizStation } from "@/features/quiz/components/quiz-station";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { playSoundEffect } from "@/lib/sound-effects";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { InventoryCard } from "@/types/domain";

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

const testUser: AuthShellUser = {
  id: "user-1",
  email: "test@example.com",
  profile: {
    displayName: "Test User",
    preferredLanguageCode: "en",
    preferredUiLocale: "tr",
    preferredTier: "A1",
  },
};

const testCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.tier === "A1")!;
const germanCard = VOCABULARY_CARDS.find((card) => card.language === "de" && card.tier === "A1")!;
const correctAnswer = getCardTranslation(testCard, "tr");

const inventoryCard: InventoryCard = {
  cardId: testCard.id,
  status: "active",
  correctCount: 0,
  addedAt: "2026-06-09T00:00:00.000Z",
};

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
    await startQuiz();
    fireEvent.click(screen.getByRole("button", { name: correctAnswer }));

    expect(playSoundEffect).toHaveBeenCalledWith("correct");
  });

  it("plays the incorrect-answer effect after a wrong guess", async () => {
    renderQuizStation();
    await startQuiz();

    const wrongOption = screen
      .getAllByRole("button")
      .find((button) => {
        const label = button.textContent?.trim();

        return label && label !== correctAnswer;
      });

    expect(wrongOption).toBeDefined();
    fireEvent.click(wrongOption!);

    expect(playSoundEffect).toHaveBeenCalledWith("incorrect");
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
    fireEvent.click(screen.getByRole("button", { name: /Alıştırmayı başlat/ }));

    await screen.findByRole("heading", { name: germanCard.term });
  });
});

function renderQuizStation() {
  render(
    <LocaleProvider initialLocale="tr">
      <AuthSessionProvider user={testUser}>
        <QuizStation mode="active" />
      </AuthSessionProvider>
    </LocaleProvider>,
  );
}

async function startQuiz() {
  fireEvent.click(screen.getByRole("button", { name: /Alıştırmayı başlat/ }));
  await screen.findByRole("heading", { name: testCard.term });
}

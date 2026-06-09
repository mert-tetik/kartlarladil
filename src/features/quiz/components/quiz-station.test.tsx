import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { QuizStation } from "@/features/quiz/components/quiz-station";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { playSoundEffect } from "@/lib/sound-effects";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { InventoryCard } from "@/types/domain";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ogren",
  useRouter: () => ({
    push: vi.fn(),
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
    preferredTier: "A1",
  },
};

const appleInventoryCard: InventoryCard = {
  cardId: "en-a1-isim-apple",
  status: "active",
  correctCount: 0,
  addedAt: "2026-06-09T00:00:00.000Z",
};

describe("QuizStation sound feedback", () => {
  beforeEach(() => {
    useInventoryStore.setState({
      cards: [appleInventoryCard],
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
    fireEvent.click(screen.getByRole("button", { name: "elma" }));

    expect(playSoundEffect).toHaveBeenCalledWith("correct");
  });

  it("plays the incorrect-answer effect after a wrong guess", async () => {
    renderQuizStation();
    await startQuiz();

    const wrongOption = screen
      .getAllByRole("button")
      .find((button) => {
        const label = button.textContent?.trim();

        return label && label !== "elma";
      });

    expect(wrongOption).toBeDefined();
    fireEvent.click(wrongOption!);

    expect(playSoundEffect).toHaveBeenCalledWith("incorrect");
  });
});

function renderQuizStation() {
  render(
    <AuthSessionProvider user={testUser}>
      <QuizStation mode="active" />
    </AuthSessionProvider>,
  );
}

async function startQuiz() {
  fireEvent.click(screen.getByRole("button", { name: /Alıştırmayı başlat/ }));
  await screen.findByRole("heading", { name: "apple" });
}

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { LearnQuizShell } from "@/app/learn/components/learn-quiz-shell";
import { VOCABULARY_CARDS } from "@/data/cards";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { LocaleProvider } from "@/i18n/locale-provider";
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

describe("LearnQuizShell", () => {
  const englishCard = VOCABULARY_CARDS.find((card) => card.language === "en")!;

  beforeEach(() => {
    window.localStorage.clear();
    useInventoryStore.setState({
      cards: [],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });
  });

  it("shows a loading skeleton while the card pool rehydrates", () => {
    useInventoryStore.setState({
      cards: [],
      attempts: [],
      hydrated: false,
    });

    render(
      <LocaleProvider initialLocale="tr">
        <LearnQuizShell
          title="Kartları öğren"
          description="Kartları çalış"
          initialMode={null}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole("status", { name: "Alıştırma hazırlanıyor" })).toBeVisible();
    expect(screen.getByText("Kart haznen okunuyor.")).toBeVisible();
  });

  it("renders the mode selection immediately when persisted cards already exist", () => {
    useInventoryStore.setState({
      cards: [createInventoryCard(englishCard.id)],
      attempts: [],
      hydrated: false,
    });

    render(
      <LocaleProvider initialLocale="en">
        <LearnQuizShell
          title="Learn cards"
          description="Study your cards"
          initialMode={null}
        />
      </LocaleProvider>,
    );

    expect(screen.queryByRole("status", { name: "Preparing practice" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Learn\b/i })).toBeVisible();
  });

  it("shows only the no-card empty state when the user has no cards", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <LearnQuizShell
          title="Kartları öğren"
          description="Kartları çalış"
          initialMode={null}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole("heading", { name: /Hen/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /Kart/ })).toHaveAttribute("href", "/card-draw");
    expect(screen.queryByText(/Nas/)).not.toBeInTheDocument();
  });
});

function createInventoryCard(cardId: string): InventoryCard {
  return {
    cardId,
    status: "active",
    correctCount: 0,
    addedAt: "2026-06-13T00:00:00.000Z",
  };
}

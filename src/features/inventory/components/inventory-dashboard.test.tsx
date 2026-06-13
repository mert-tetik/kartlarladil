import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import { VOCABULARY_CARDS } from "@/data/cards";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { InventoryDashboard } from "@/features/inventory/components/inventory-dashboard";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { InventoryCard } from "@/types/domain";

vi.mock("next/navigation", () => ({
  usePathname: () => "/my-cards",
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

describe("InventoryDashboard", () => {
  const englishCard = VOCABULARY_CARDS.find((card) => card.language === "en")!;
  const germanCard = VOCABULARY_CARDS.find((card) => card.language === "de")!;

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

  it("shows only languages that have cards", () => {
    useInventoryStore.setState({
      cards: [
        createInventoryCard(englishCard.id),
        createInventoryCard(germanCard.id),
      ],
    });

    render(
      <LocaleProvider initialLocale="tr">
        <AuthSessionProvider user={null}>
          <InventoryDashboard />
        </AuthSessionProvider>
      </LocaleProvider>,
    );

    expect(screen.getByRole("img", { name: LANGUAGE_BY_CODE.en.nativeName })).toBeVisible();
    expect(screen.getByRole("img", { name: LANGUAGE_BY_CODE.de.nativeName })).toBeVisible();
    expect(screen.queryByRole("img", { name: LANGUAGE_BY_CODE.ru.nativeName })).not.toBeInTheDocument();
  });

  it("shows a localized empty message when there are no cards in any language", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <AuthSessionProvider user={null}>
          <InventoryDashboard />
        </AuthSessionProvider>
      </LocaleProvider>,
    );

    expect(screen.getByRole("heading", { name: "Hiçbir dilde kartınız yok" })).toBeVisible();
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

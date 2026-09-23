import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { LearnQuizShell } from "@/app/learn/components/learn-quiz-shell";
import { VOCABULARY_CARDS } from "@/data/cards";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { InventoryCard } from "@/types/domain";

const routerReplaceMock = vi.hoisted(() => vi.fn());
const authSessionMock = vi.hoisted(() => ({ current: null as { user: AuthShellUser } | null }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/learn",
  useRouter: () => ({
    push: vi.fn(),
    replace: routerReplaceMock,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/features/auth/auth-client", () => ({
  useOptionalAuthSession: () => authSessionMock.current,
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
    routerReplaceMock.mockReset();
    authSessionMock.current = null;
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

  it("redirects to the landing page when inventory has no quizable language", async () => {
    useInventoryStore.setState({
      cards: [createInventoryCard(englishCard.id)],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudLoadComplete: true,
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

    await waitFor(() => expect(routerReplaceMock).toHaveBeenCalledWith("/"));
  });

  it("redirects instead of opening a mode with no usable cards", async () => {
    useInventoryStore.setState({
      cards: [{ ...createInventoryCard(englishCard.id), status: "learned" }],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudLoadComplete: true,
    });

    render(
      <LocaleProvider initialLocale="tr">
        <LearnQuizShell
          title="Kartları öğren"
          description="Kartlarını çalış"
          initialMode={null}
        />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Öğren/i }));
    await waitFor(() => expect(routerReplaceMock).toHaveBeenCalledWith("/"));
  });

  it("waits for the authenticated cloud inventory before deciding it is empty", async () => {
    const user: AuthShellUser = {
      id: "user-1",
      email: "user@example.com",
      profile: {
        displayName: null,
        preferredLanguageCode: "en",
        preferredUiLocale: "en",
        preferredTier: "A1",
        onboardingCompleted: true,
        aiPracticePoints: 0,
        chestPoints: 0,
        pushMarketingEnabled: false,
      },
    };

    useInventoryStore.setState({
      cards: [],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudLoadComplete: true,
      ownerUserId: null,
    });

    authSessionMock.current = { user };

    render(
      <LocaleProvider initialLocale="en">
        <LearnQuizShell
          title="Learn cards"
          description="Study your cards"
          initialMode={null}
        />
      </LocaleProvider>,
    );

    expect(routerReplaceMock).not.toHaveBeenCalled();

    await act(async () => {
      useInventoryStore.setState({
        cloudEnabled: true,
        cloudLoadComplete: true,
        ownerUserId: user.id,
      });
    });

    await waitFor(() => expect(routerReplaceMock).toHaveBeenCalledWith("/"));
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

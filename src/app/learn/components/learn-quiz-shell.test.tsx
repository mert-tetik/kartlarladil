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
const subscriptionMock = vi.hoisted(() => ({
  current: { entitlements: null as { effectivePlan: string } | null, isLoading: false },
}));

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

vi.mock("@/features/subscriptions/subscription-client", () => ({
  useSubscription: () => subscriptionMock.current,
}));

vi.mock("@/features/subscriptions/components/upgrade-dialog", () => ({
  UpgradeDialog: ({
    open,
    errorCode,
    onOpenChange,
  }: {
    open: boolean;
    errorCode: string | null;
    onOpenChange: (open: boolean) => void;
  }) => open ? (
    <div data-testid="upgrade-dialog" data-error-code={errorCode}>
      <button type="button" onClick={() => onOpenChange(false)}>Dismiss restriction</button>
    </div>
  ) : null,
}));

vi.mock("@/features/quiz/components/quiz-station", () => ({
  QuizStation: ({ mode }: { mode: string }) => <div data-testid="quiz-station" data-mode={mode} />,
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
    subscriptionMock.current = { entitlements: { effectivePlan: "free" }, isLoading: false };
    useInventoryStore.setState({
      cards: [],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });
  });

  it("does not show a loading indicator while the card pool rehydrates", () => {
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

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("Kart haznen okunuyor.")).not.toBeInTheDocument();
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

  it("blocks direct learned-review URLs for Free users and returns to mode selection when dismissed", () => {
    useInventoryStore.setState({
      cards: [{ ...createInventoryCard(englishCard.id), status: "learned" }],
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
          initialMode="learned"
        />
      </LocaleProvider>,
    );

    expect(screen.queryByTestId("quiz-station")).not.toBeInTheDocument();
    expect(screen.getByTestId("upgrade-dialog")).toHaveAttribute(
      "data-error-code",
      "learned_review_subscription_required",
    );

    fireEvent.click(screen.getByRole("button", { name: "Dismiss restriction" }));

    expect(screen.queryByTestId("upgrade-dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review practice/i })).toBeVisible();
  });

  it("allows learned review when the server entitlement is Basic or Pro", () => {
    subscriptionMock.current = { entitlements: { effectivePlan: "pro" }, isLoading: false };
    useInventoryStore.setState({
      cards: [{ ...createInventoryCard(englishCard.id), status: "learned" }],
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
          initialMode="learned"
        />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("quiz-station")).toHaveAttribute("data-mode", "learned");
    expect(screen.queryByTestId("upgrade-dialog")).not.toBeInTheDocument();
  });

  it("waits for unresolved server entitlements before opening a learned review quiz", () => {
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
    authSessionMock.current = { user };
    subscriptionMock.current = { entitlements: null, isLoading: true };
    useInventoryStore.setState({
      cards: [{ ...createInventoryCard(englishCard.id), status: "learned" }],
      attempts: [],
      hydrated: true,
      cloudEnabled: true,
      cloudLoading: false,
      cloudLoadComplete: true,
      ownerUserId: user.id,
    });

    const { container, rerender } = render(
      <LocaleProvider initialLocale="en">
        <LearnQuizShell
          title="Learn cards"
          description="Study your cards"
          initialMode="learned"
        />
      </LocaleProvider>,
    );

    expect(container.querySelector("[data-testid='quiz-station']")).toBeNull();
    expect(screen.queryByTestId("upgrade-dialog")).not.toBeInTheDocument();

    subscriptionMock.current = { entitlements: { effectivePlan: "basic" }, isLoading: false };
    rerender(
      <LocaleProvider initialLocale="en">
        <LearnQuizShell
          title="Learn cards"
          description="Study your cards"
          initialMode="learned"
        />
      </LocaleProvider>,
    );

    expect(screen.getByTestId("quiz-station")).toHaveAttribute("data-mode", "learned");
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

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileLandingDashboard } from "@/app/components/mobile-landing-dashboard";
import {
  LANDING_CARD_LANGUAGE_KEY,
  writeLandingCardLanguage,
} from "@/app/components/landing-card-language";
import { EMPTY_PROGRESS_STATS } from "@/features/progress/progress-stats";
import { VOCABULARY_CARDS } from "@/data/cards";
import { getLanguageDisplayName } from "@/i18n/labels";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { InventoryCard, SubscriptionPlan } from "@/types/domain";

const { inventoryCardsMock, refreshEntitlementsMock, routerPushMock, subscriptionPlanMock, useLeaderboardDataMock } = vi.hoisted(() => ({
  inventoryCardsMock: { value: [] as InventoryCard[] },
  refreshEntitlementsMock: vi.fn(),
  routerPushMock: vi.fn(),
  subscriptionPlanMock: { value: "free" as SubscriptionPlan },
  useLeaderboardDataMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    prefetch: vi.fn(),
    push: routerPushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/auth/auth-client", () => ({
  useAuthSession: () => ({
    user: {
      id: "test-user",
      email: "test@example.com",
      profile: {
        displayName: "Test User",
        preferredLanguageCode: "en",
        preferredUiLocale: "tr",
        preferredTier: "A1",
        onboardingCompleted: true,
        aiPracticePoints: 0,
        chestPoints: 0,
        streakPoints: 0,
      },
    },
  }),
  useRequireAuthAction: () => (action: () => void) => action(),
}));

vi.mock("@/features/progress/progress-client", () => ({
  useProgressStats: () => ({ stats: EMPTY_PROGRESS_STATS }),
}));

vi.mock("@/features/subscriptions/subscription-client", () => ({
  useSubscription: () => ({
    entitlements: { effectivePlan: subscriptionPlanMock.value },
    isLoading: false,
    refreshEntitlements: refreshEntitlementsMock,
  }),
}));

vi.mock("@/features/leaderboard/use-leaderboard", () => ({
  useLeaderboardData: useLeaderboardDataMock,
}));

vi.mock("@/features/inventory/inventory-store", () => ({
  useInventoryStore: (selector: (state: {
    cards: InventoryCard[];
    pendingCardIds: Set<string>;
    removeCard: () => Promise<void>;
  }) => unknown) =>
    selector({
      cards: inventoryCardsMock.value,
      pendingCardIds: new Set<string>(),
      removeCard: vi.fn(async () => {}),
    }),
}));

describe("MobileLandingDashboard language sync", () => {
  beforeEach(() => {
    window.localStorage.clear();
    inventoryCardsMock.value = [];
    subscriptionPlanMock.value = "free";
    refreshEntitlementsMock.mockReset();
    refreshEntitlementsMock.mockImplementation(async () => ({
      effectivePlan: subscriptionPlanMock.value,
    }));
    routerPushMock.mockReset();
    useLeaderboardDataMock.mockReturnValue({
      data: {
        viewer: {
          userId: "test-user",
          position: 17,
          displayName: "Test User",
          totalPoints: 420,
          leaderboardVisible: true,
        },
        entries: [],
        canViewLeaderboard: true,
      },
    });
  });

  it("shows the current user's leaderboard position", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    expect(screen.getByText("Dünyada 17.")).toBeInTheDocument();
  });

  it("keeps the how-to button above the rank layer with a full touch target", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    expect(screen.getByRole("button", { name: "Nasıl kullanılır?" })).toHaveClass(
      "z-30",
      "size-11",
    );
  });

  it("updates the visible card language when onboarding writes a new landing language", async () => {
    window.localStorage.setItem(LANDING_CARD_LANGUAGE_KEY, "ko");

    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    expect(screen.getByText(getLanguageDisplayName("ko", "tr"))).toBeInTheDocument();

    act(() => {
      writeLandingCardLanguage("en");
    });

    await waitFor(() => {
      expect(screen.getByText(getLanguageDisplayName("en", "tr"))).toBeInTheDocument();
    });
    expect(screen.queryByText(getLanguageDisplayName("ko", "tr"))).not.toBeInTheDocument();
  });

  it("opens the subscription dialog for free users reviewing learned cards", async () => {
    const user = userEvent.setup();
    const englishCard = VOCABULARY_CARDS.find((card) => card.language === "en")!;
    inventoryCardsMock.value = [{
      cardId: englishCard.id,
      status: "learned",
      correctCount: 4,
      addedAt: "2026-07-12T00:00:00.000Z",
      learnedAt: "2026-07-12T01:00:00.000Z",
    }];

    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Öğrenilenleri Tekrar Et" }));

    expect(await screen.findByRole("heading", { name: /abonelik gerekli/i })).toBeInTheDocument();
    expect(refreshEntitlementsMock).toHaveBeenCalledOnce();
    expect(routerPushMock).not.toHaveBeenCalledWith(expect.stringContaining("mode=learned"));
  });

  it("starts learned-card review for paid users", async () => {
    const user = userEvent.setup();
    const englishCard = VOCABULARY_CARDS.find((card) => card.language === "en")!;
    subscriptionPlanMock.value = "basic";
    inventoryCardsMock.value = [{
      cardId: englishCard.id,
      status: "learned",
      correctCount: 4,
      addedAt: "2026-07-12T00:00:00.000Z",
      learnedAt: "2026-07-12T01:00:00.000Z",
    }];

    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Öğrenilenleri Tekrar Et" }));

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith("/learn?mode=learned&language=en");
    });
  });

  it("blocks review when a stale paid cache is rejected by the server", async () => {
    const user = userEvent.setup();
    const englishCard = VOCABULARY_CARDS.find((card) => card.language === "en")!;
    subscriptionPlanMock.value = "basic";
    refreshEntitlementsMock.mockResolvedValue({ effectivePlan: "free" });
    inventoryCardsMock.value = [{
      cardId: englishCard.id,
      status: "learned",
      correctCount: 4,
      addedAt: "2026-07-12T00:00:00.000Z",
      learnedAt: "2026-07-12T01:00:00.000Z",
    }];

    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Öğrenilenleri Tekrar Et" }));

    expect(await screen.findByRole("heading", { name: /abonelik gerekli/i })).toBeInTheDocument();
    expect(routerPushMock).not.toHaveBeenCalledWith(expect.stringContaining("mode=learned"));
  });
});

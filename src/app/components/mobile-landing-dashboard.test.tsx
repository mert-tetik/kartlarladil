import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import {
  dispatchTutorialCardLayerClosed,
  dispatchTutorialCardLayerOpened,
} from "@/features/tutorial/tutorial-card-session";

const {
  consumePlayReviewEligibilityMock,
  hasPlayReviewEligibilityMock,
  addCardsMock,
  inventoryCardsMock,
  isTwaModeMock,
  refreshEntitlementsMock,
  requestGooglePlayReviewMock,
  routerPushMock,
  subscriptionPlanMock,
  useLeaderboardDataMock,
} = vi.hoisted(() => ({
  consumePlayReviewEligibilityMock: vi.fn(),
  hasPlayReviewEligibilityMock: vi.fn(),
  addCardsMock: vi.fn(),
  inventoryCardsMock: { value: [] as InventoryCard[] },
  isTwaModeMock: { value: false },
  refreshEntitlementsMock: vi.fn(),
  requestGooglePlayReviewMock: vi.fn(),
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

vi.mock("@/features/install-app/use-twa-mode", () => ({
  useTwaMode: () => isTwaModeMock.value,
}));

vi.mock("@/features/reviews/play-review-eligibility", () => ({
  consumePlayReviewEligibility: consumePlayReviewEligibilityMock,
  hasPlayReviewEligibility: hasPlayReviewEligibilityMock,
}));

vi.mock("@/lib/twa-analytics", () => ({
  requestGooglePlayReview: requestGooglePlayReviewMock,
}));

vi.mock("@/features/inventory/inventory-store", () => {
  const useInventoryStore = Object.assign(
    (selector: (state: {
      cards: InventoryCard[];
      addCards: typeof addCardsMock;
      hydrated: boolean;
      pendingCardIds: Set<string>;
      removeCard: () => Promise<void>;
    }) => unknown) =>
      selector({
        cards: inventoryCardsMock.value,
        addCards: addCardsMock,
        hydrated: true,
        pendingCardIds: new Set<string>(),
        removeCard: vi.fn(async () => {}),
      }),
    {
      getState: () => ({ cards: inventoryCardsMock.value }),
    },
  );

  return { useInventoryStore };
});

describe("MobileLandingDashboard language sync", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    window.localStorage.clear();
    inventoryCardsMock.value = [];
    addCardsMock.mockReset();
    addCardsMock.mockResolvedValue({
      ok: true,
      firstCardAdded: true,
      addedCardIds: ["starter-card"],
      remainingCardIds: [],
      limitReached: false,
    });
    isTwaModeMock.value = false;
    hasPlayReviewEligibilityMock.mockReset();
    hasPlayReviewEligibilityMock.mockReturnValue(false);
    consumePlayReviewEligibilityMock.mockReset();
    consumePlayReviewEligibilityMock.mockReturnValue(null);
    requestGooglePlayReviewMock.mockReset();
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

  it("keeps the landing language valid when any card-add action is clicked", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    for (const target of ["landing-draw-cards", "landing-create-card", "landing-card-groups"]) {
      const button = document.querySelector<HTMLButtonElement>(`[data-tutorial-target="${target}"]`);
      expect(button).not.toBeNull();
      fireEvent.click(button!);
    }

    const landingLanguageButton = document.querySelector<HTMLButtonElement>("[data-mobile-landing-card-language]");
    expect(landingLanguageButton).not.toBeNull();
    expect(within(landingLanguageButton!).getByText(getLanguageDisplayName("en", "tr"))).toBeInTheDocument();
  });

  it("adds starter cards only when the selected language has no learning cards", async () => {
    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    dispatchTutorialCardLayerOpened({ layer: "draw-cards", origin: { x: 10, y: 10 } });
    dispatchTutorialCardLayerClosed({ layer: "draw-cards" });

    await waitFor(() => expect(addCardsMock).toHaveBeenCalledOnce());
    expect(addCardsMock.mock.calls[0][0]).toHaveLength(3);

    addCardsMock.mockClear();
    const learningCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.tier === "A1");
    expect(learningCard).toBeDefined();
    inventoryCardsMock.value = [{
      cardId: learningCard!.sourceKey,
      status: "active",
      correctCount: 0,
      addedAt: "2026-09-06T00:00:00.000Z",
    }];

    dispatchTutorialCardLayerOpened({ layer: "draw-cards", origin: { x: 10, y: 10 } });
    dispatchTutorialCardLayerClosed({ layer: "draw-cards" });
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(addCardsMock).not.toHaveBeenCalled();
  });

  it("requests the native review flow after eligible activity when the TWA deck has 10 cards", async () => {
    isTwaModeMock.value = true;
    hasPlayReviewEligibilityMock.mockReturnValue(true);
    consumePlayReviewEligibilityMock.mockReturnValue("quiz");
    inventoryCardsMock.value = VOCABULARY_CARDS.slice(0, 10).map((card) => ({
      cardId: card.id,
      status: "active",
      correctCount: 0,
      addedAt: "2026-07-12T00:00:00.000Z",
    }));

    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    await waitFor(() => {
      expect(consumePlayReviewEligibilityMock).toHaveBeenCalledOnce();
      expect(requestGooglePlayReviewMock).toHaveBeenCalledOnce();
    });
  });

  it("does not request a review before the deck reaches 10 cards", () => {
    isTwaModeMock.value = true;
    hasPlayReviewEligibilityMock.mockReturnValue(true);
    inventoryCardsMock.value = VOCABULARY_CARDS.slice(0, 9).map((card) => ({
      cardId: card.id,
      status: "active",
      correctCount: 0,
      addedAt: "2026-07-12T00:00:00.000Z",
    }));

    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    expect(consumePlayReviewEligibilityMock).not.toHaveBeenCalled();
    expect(requestGooglePlayReviewMock).not.toHaveBeenCalled();
  });

  it("temporarily hides the how-to action on mobile", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    expect(document.querySelector("[data-mobile-landing-info-action]")).toHaveAttribute("hidden");
  });

  it("expands the card center before enabling landing scroll", async () => {
    const user = userEvent.setup();

    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    const dashboard = document.querySelector("[data-mobile-landing-dashboard]");
    expect(dashboard).toHaveClass("overflow-y-hidden");
    expect(document.querySelector('[data-tutorial-target="rank-info"]')).toHaveClass("isolate", "overflow-hidden");
    expect(screen.queryByRole("button", { name: "T\u00fcm Kartlar" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kartlar" }));

    expect(dashboard).toHaveClass("overflow-y-auto");
    expect(screen.getByRole("button", { name: "T\u00fcm Kartlar" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kartlar" }));

    expect(dashboard).toHaveClass("overflow-y-hidden");
    expect(screen.queryByRole("button", { name: "T\u00fcm Kartlar" })).not.toBeInTheDocument();
  });

  it("updates the visible card language when onboarding writes a new landing language", async () => {
    window.localStorage.setItem(LANDING_CARD_LANGUAGE_KEY, "ko");

    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    const landingLanguageButton = document.querySelector<HTMLButtonElement>("[data-mobile-landing-card-language]");
    expect(landingLanguageButton).not.toBeNull();
    expect(within(landingLanguageButton!).getByText(getLanguageDisplayName("ko", "tr"))).toBeInTheDocument();

    act(() => {
      writeLandingCardLanguage("en");
    });

    await waitFor(() => {
      expect(within(landingLanguageButton!).getByText(getLanguageDisplayName("en", "tr"))).toBeInTheDocument();
    });
    expect(within(landingLanguageButton!).queryByText(getLanguageDisplayName("ko", "tr"))).not.toBeInTheDocument();
  });

  it("shows the draw pointer after switching from a populated language to an empty language", async () => {
    const user = userEvent.setup();
    const englishCard = VOCABULARY_CARDS.find((card) => card.language === "en")!;
    inventoryCardsMock.value = [{
      cardId: englishCard.id,
      status: "active",
      correctCount: 0,
      addedAt: "2026-07-12T00:00:00.000Z",
    }];

    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingDashboard />
      </LocaleProvider>,
    );

    expect(screen.queryByTestId("mobile-empty-deck-pointer")).not.toBeInTheDocument();

    const languageButton = document.querySelector<HTMLButtonElement>("[data-mobile-landing-card-language]");
    expect(languageButton).not.toBeNull();
    await user.click(languageButton!);
    await user.click(screen.getByRole("button", { name: /Fransızca/i }));

    await waitFor(() => {
      expect(screen.getByTestId("mobile-empty-deck-pointer")).toBeInTheDocument();
    });
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

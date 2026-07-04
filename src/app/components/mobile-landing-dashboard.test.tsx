import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileLandingDashboard } from "@/app/components/mobile-landing-dashboard";
import {
  LANDING_CARD_LANGUAGE_KEY,
  writeLandingCardLanguage,
} from "@/app/components/landing-card-language";
import { EMPTY_PROGRESS_STATS } from "@/features/progress/progress-stats";
import { getLanguageDisplayName } from "@/i18n/labels";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    prefetch: vi.fn(),
    push: vi.fn(),
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

vi.mock("@/features/inventory/inventory-store", () => ({
  useInventoryStore: (selector: (state: {
    cards: [];
    pendingCardIds: Set<string>;
    removeCard: () => Promise<void>;
  }) => unknown) =>
    selector({
      cards: [],
      pendingCardIds: new Set<string>(),
      removeCard: vi.fn(async () => {}),
    }),
}));

describe("MobileLandingDashboard language sync", () => {
  beforeEach(() => {
    window.localStorage.clear();
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
});

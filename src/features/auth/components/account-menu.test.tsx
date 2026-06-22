import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { AuthShellUser } from "@/features/auth/auth-types";

vi.mock("@/features/progress/progress-client", () => ({
  useProgressStats: () => ({
    stats: {
      totalPoints: 500,
      totalCards: 10,
      activeCards: 4,
      learnedCards: 6,
      rank: { id: "baslangic", label: "Starter", minPoints: 0, icon: "book" },
      nextRank: { id: "kart-ciragi", label: "Card Apprentice", minPoints: 200, icon: "book" },
      pointsToNextRank: 100,
      rankProgressPercent: 50,
      tierStats: [
        { tier: "A1", total: 1, learned: 1, points: 10 },
        { tier: "A2", total: 1, learned: 1, points: 20 },
        { tier: "B1", total: 1, learned: 1, points: 40 },
        { tier: "B2", total: 1, learned: 1, points: 50 },
        { tier: "C1", total: 1, learned: 1, points: 100 },
      ],
      languageStats: [],
    },
  }),
}));

vi.mock("@/features/subscriptions/subscription-client", () => ({
  useSubscription: () => ({
    entitlements: { effectivePlan: "free" },
    isLoading: false,
  }),
}));

vi.mock("@/features/auth/components/theme-picker-dialog", () => ({
  ThemePickerDialog: () => null,
}));

vi.mock("@/features/auth/actions", () => ({
  logoutAction: vi.fn(),
}));

vi.mock("@/lib/vibration", async () => {
  const actual = await vi.importActual<typeof import("@/lib/vibration")>("@/lib/vibration");
  return {
    ...actual,
    useVibration: () => ({
      supported: false,
      enabled: false,
      toggle: vi.fn(),
      trigger: vi.fn(),
    }),
  };
});

const testUser: AuthShellUser = {
  id: "user-1",
  email: "test@example.com",
  profile: {
    displayName: "Test User",
    preferredLanguageCode: "en",
    preferredUiLocale: "tr",
    preferredTier: "A1",
    aiPracticePoints: 0,
    chestPoints: 0,
    theme: "default",
  },
};

describe("AccountMenu", () => {
  it("keeps the logout form mounted when logout is clicked", async () => {
    const user = userEvent.setup();

    render(
      <LocaleProvider initialLocale="tr">
        <AccountMenu user={testUser} />
      </LocaleProvider>,
    );

    await user.click(screen.getByRole("button", { name: /hesap menüsü/i }));

    const logoutButton = screen.getByRole("menuitem", { name: /çıkış yap/i });
    const logoutForm = logoutButton.closest("form");

    expect(logoutForm).not.toBeNull();

    await user.click(logoutButton);

    expect(screen.getByRole("menuitem", { name: /çıkış yap/i })).toBeInTheDocument();
    expect(logoutForm).toBeInTheDocument();
  });
});

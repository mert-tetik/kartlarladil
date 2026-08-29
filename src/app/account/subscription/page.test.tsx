import { render, screen } from "@testing-library/react";
import AccountSubscriptionPage from "@/app/account/subscription/page";
import { vi } from "vitest";
import type { ReactNode } from "react";

const mockRequireAuthUser = vi.hoisted(() => vi.fn());
const mockGetUserEntitlements = vi.hoisted(() => vi.fn());

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/auth/auth-session", () => ({
  requireAuthUser: mockRequireAuthUser,
}));

vi.mock("@/features/subscriptions/subscription-service", () => ({
  getUserEntitlements: mockGetUserEntitlements,
}));

vi.mock("@/features/subscriptions/components/subscription-settings", () => ({
  SubscriptionSettings: ({ plan }: { plan: string }) => (
    <div data-testid="subscription-settings">{plan}</div>
  ),
}));

vi.mock("@/i18n/server", () => ({
  getServerLocale: vi.fn(() => Promise.resolve("en")),
}));

describe("AccountSubscriptionPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAuthUser.mockResolvedValue({ id: "user-1", email: "test@example.com" });
    mockGetUserEntitlements.mockResolvedValue({
      plan: "pro",
      effectivePlan: "pro",
      status: "active",
      provider: "google_play",
      limits: {
        activeCards: null,
        learnedCards: null,
        aiDailyMessages: 150,
        aiMonthlyMessages: 4500,
      },
      customerPortalUrl: null,
    });

  });

  it("renders the Google Play subscription settings", async () => {
    render(await AccountSubscriptionPage());

    expect(screen.getByTestId("subscription-settings")).toHaveTextContent("pro");
  });
});

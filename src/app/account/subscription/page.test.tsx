import { render, screen } from "@testing-library/react";
import AccountSubscriptionPage from "@/app/account/subscription/page";
import { vi } from "vitest";
import type { ReactNode } from "react";

const mockRequireAuthUser = vi.hoisted(() => vi.fn());
const mockGetUserEntitlements = vi.hoisted(() => vi.fn());
const mockCreateSupabaseServerClient = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

vi.mock("@/i18n/server", () => ({
  getServerLocale: vi.fn(() => Promise.resolve("en")),
}));

describe("AccountSubscriptionPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAuthUser.mockResolvedValue({ id: "user-1", email: "test@example.com" });
    mockGetUserEntitlements.mockResolvedValue({
      effectivePlan: "pro",
    });

    const query = {
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => query),
      returns: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "event-row-1",
              event_name: "subscription_updated",
              payload: {},
              processed_at: "2026-06-22T00:00:00Z",
              error_message: null,
              created_at: "2026-06-22T00:00:00Z",
            },
          ],
        }),
      ),
    };

    mockSelect.mockReturnValue(query);
    mockCreateSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: mockSelect,
      })),
    });
  });

  it("selects webhook events by the real id column and renders them", async () => {
    render(await AccountSubscriptionPage());

    expect(mockSelect).toHaveBeenCalledWith("id, event_name, payload, processed_at, error_message, created_at");
    expect(screen.getByText("subscription_updated")).toBeInTheDocument();
    expect(screen.getByTestId("subscription-settings")).toHaveTextContent("pro");
  });
});

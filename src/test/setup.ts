import { vi } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/subscriptions/subscription-client", () => ({
  SubscriptionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSubscription: () => ({
    entitlements: null,
    isLoading: false,
    error: null,
    refreshEntitlements: vi.fn(),
  }),
}));

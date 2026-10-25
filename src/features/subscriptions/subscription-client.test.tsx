import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
vi.unmock("@/features/subscriptions/subscription-client");
import { SubscriptionProvider, useSubscription } from "@/features/subscriptions/subscription-client";
import type { UserEntitlements } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  getUserEntitlementsAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/features/subscriptions/subscription-actions", () => ({
  getUserEntitlementsAction: mocks.getUserEntitlementsAction,
}));
vi.mock("@/features/auth/auth-client", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/features/subscriptions/use-google-play-billing", () => ({
  useGooglePlayBilling: () => ({ isSupported: false, restorePurchases: vi.fn() }),
}));
vi.mock("@/features/install-app/use-twa-mode", () => ({ useTwaMode: () => false }));
vi.mock("@/features/subscriptions/use-google-play-pricing", () => ({ useGooglePlayPricing: () => null }));
vi.mock("@/features/subscriptions/components/subscription-purchase-success-dialog", () => ({
  SubscriptionPurchaseSuccessDialog: () => null,
}));
vi.mock("@/components/app-message-provider", () => ({ useAppMessage: () => ({ showMessage: vi.fn() }) }));
vi.mock("@/lib/visual-test-mode", () => ({ isMissionVisualTestRoute: () => false }));

const paidEntitlements: UserEntitlements = {
  plan: "pro",
  effectivePlan: "pro",
  status: "active",
  provider: "google_play",
  limits: {
    activeCards: null,
    learnedCards: null,
    aiDailyMessages: null,
    aiMonthlyMessages: null,
  },
  customerPortalUrl: null,
  endsAt: "2099-01-01T00:00:00.000Z",
};

const staleFreeEntitlements: UserEntitlements = {
  ...paidEntitlements,
  plan: "free",
  effectivePlan: "free",
  status: "free",
  provider: "admin",
  limits: {
    activeCards: 20,
    learnedCards: 100,
    aiDailyMessages: 10,
    aiMonthlyMessages: 200,
  },
  endsAt: null,
};

function EntitlementHarness() {
  const { entitlements, applyVerifiedEntitlements } = useSubscription();

  return (
    <>
      <output data-testid="effective-plan">{entitlements?.effectivePlan ?? "unresolved"}</output>
      <button onClick={() => applyVerifiedEntitlements(paidEntitlements)}>Apply verified purchase</button>
    </>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  window.localStorage.clear();
  mocks.getUserEntitlementsAction.mockReset();
});

it("does not let an older server entitlement response overwrite a verified purchase", async () => {
  const serverRead = deferred<{
    status: "success";
    message: string;
    data: UserEntitlements;
  }>();
  mocks.getUserEntitlementsAction.mockReturnValueOnce(serverRead.promise);

  render(
    <SubscriptionProvider>
      <EntitlementHarness />
    </SubscriptionProvider>,
  );

  await waitFor(() => expect(mocks.getUserEntitlementsAction).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Apply verified purchase" }));

  await act(async () => {
    serverRead.resolve({ status: "success", message: "", data: staleFreeEntitlements });
    await serverRead.promise;
  });

  expect(screen.getByTestId("effective-plan")).toHaveTextContent("pro");
  expect(JSON.parse(window.localStorage.getItem("foxiesdeck:entitlements:user-1") ?? "null"))
    .toMatchObject({ effectivePlan: "pro" });
});

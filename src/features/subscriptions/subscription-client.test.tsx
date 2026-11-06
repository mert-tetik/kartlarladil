import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
vi.unmock("@/features/subscriptions/subscription-client");
import { SubscriptionProvider, useSubscription } from "@/features/subscriptions/subscription-client";
import type { UserEntitlements } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  getUserEntitlementsAction: vi.fn(),
  restorePurchases: vi.fn(),
  isSupported: false,
  isTwa: false,
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
  useGooglePlayBilling: () => ({
    isSupported: mocks.isSupported,
    restorePurchases: mocks.restorePurchases,
  }),
}));
vi.mock("@/features/install-app/use-twa-mode", () => ({ useTwaMode: () => mocks.isTwa }));
vi.mock("@/features/subscriptions/use-google-play-pricing", () => ({ useGooglePlayPricing: () => null }));
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

let originalVisibilityStateDescriptor: PropertyDescriptor | undefined;

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
  originalVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
  mocks.getUserEntitlementsAction.mockReset();
  mocks.restorePurchases.mockReset().mockResolvedValue(undefined);
  mocks.isSupported = false;
  mocks.isTwa = false;
});

afterEach(() => {
  vi.useRealTimers();
  if (originalVisibilityStateDescriptor) {
    Object.defineProperty(document, "visibilityState", originalVisibilityStateDescriptor);
  } else {
    Reflect.deleteProperty(document, "visibilityState");
  }
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

it("syncs Google Play again when the TWA returns to the foreground", async () => {
  mocks.isTwa = true;
  mocks.isSupported = true;
  mocks.getUserEntitlementsAction.mockResolvedValue({
    status: "success",
    message: "",
    data: staleFreeEntitlements,
  });
  vi.useFakeTimers();

  render(
    <SubscriptionProvider>
      <EntitlementHarness />
    </SubscriptionProvider>,
  );

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(mocks.restorePurchases).toHaveBeenCalledOnce();

  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_001);
  });
  fireEvent(document, new Event("visibilitychange"));
  await act(async () => {
    await Promise.resolve();
  });

  expect(mocks.restorePurchases).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
});

it("checks Google Play before changing a paid UI to Free at the saved expiry", async () => {
  mocks.isTwa = true;
  mocks.isSupported = true;
  const pendingExpirySync = deferred<void>();
  mocks.restorePurchases
    .mockResolvedValueOnce(undefined)
    .mockImplementationOnce(() => pendingExpirySync.promise);
  mocks.getUserEntitlementsAction.mockResolvedValue({
    status: "success",
    message: "",
    data: {
      ...paidEntitlements,
      endsAt: new Date(Date.now() + 100).toISOString(),
    },
  });

  render(
    <SubscriptionProvider>
      <EntitlementHarness />
    </SubscriptionProvider>,
  );

  await waitFor(() => expect(screen.getByTestId("effective-plan")).toHaveTextContent("pro"));
  await waitFor(() => expect(mocks.restorePurchases).toHaveBeenCalledTimes(2));

  expect(screen.getByTestId("effective-plan")).toHaveTextContent("pro");

  await act(async () => {
    pendingExpirySync.resolve();
    await pendingExpirySync.promise;
    fireEvent.click(screen.getByRole("button", { name: "Apply verified purchase" }));
  });
});

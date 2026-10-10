import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileAuthGateway } from "@/features/auth/components/mobile-auth-gateway";

const mocks = vi.hoisted(() => ({
  activateTutorial: vi.fn(),
  deactivateTutorial: vi.fn(),
  resetTutorial: vi.fn(),
  router: {
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => mocks.router,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("@/features/auth/auth-client", () => ({
  useAuthSession: () => ({
    user: { profile: { onboardingCompleted: true } },
    refreshProfile: vi.fn(),
    updateProfileField: vi.fn(),
    clearUser: vi.fn(),
  }),
}));

vi.mock("@/features/subscriptions/subscription-client", () => ({
  useSubscription: () => ({
    entitlements: { effectivePlan: "free" },
    isLoading: false,
    error: null,
    refreshEntitlements: vi.fn(),
    presentPurchaseSuccess: vi.fn(),
  }),
}));

vi.mock("@/features/tutorial/tutorial-store", () => ({
  useTutorialStore: (select: (state: Record<string, () => void>) => unknown) =>
    select({
      activate: mocks.activateTutorial,
      deactivate: mocks.deactivateTutorial,
      reset: mocks.resetTutorial,
    }),
}));

vi.mock("@/features/install-app/twa-mode", () => ({
  initTwaModeStore: vi.fn(),
  isInstalledApp: () => true,
  isIosMobileTestMode: () => false,
  isMobileTestMode: () => false,
}));

vi.mock("@/features/auth/mobile-gateway-bootstrap", () => ({
  shouldKeepMobileGatewayBootstrapVisible: () => false,
}));

vi.mock("@/features/auth/components/mobile-onboarding-form", () => ({
  MobileOnboardingForm: ({
    mode,
    onComplete,
  }: {
    mode?: "initial" | "login-language-refresh";
    onComplete?: () => void;
  }) => (
    <button
      data-testid="mobile-login-language-refresh"
      data-onboarding-mode={mode ?? "initial"}
      onClick={onComplete}
      type="button"
    >
      Complete language choices
    </button>
  ),
}));

vi.mock("@/features/auth/components/mobile-subscription-offer-screen", () => ({
  MobileSubscriptionOfferScreen: ({ onContinueFree }: { onContinueFree: () => void }) => (
    <button data-testid="mobile-subscription-offer" onClick={onContinueFree} type="button">
      Continue free
    </button>
  ),
}));

vi.mock("@/features/auth/components/mobile-app-choice-screen", () => ({
  MobileAppChoiceScreen: () => <div data-testid="mobile-app-choice" />,
}));

vi.mock("@/features/auth/components/mobile-auth-screen", () => ({
  MobileAuthScreen: () => <div data-testid="mobile-auth-screen" />,
}));

describe("MobileAuthGateway returning-login flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.replace.mockImplementation((href) => {
      window.history.replaceState({}, "", String(href));
    });
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/?mobileLanguageRefresh=1&showOffer=1");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
  });

  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("requires language reselection before the offer, then resumes the tutorial", async () => {
    const user = userEvent.setup();
    render(<MobileAuthGateway countryCode="US" />);

    const languageRefresh = await screen.findByTestId("mobile-login-language-refresh");
    expect(languageRefresh).toHaveAttribute("data-onboarding-mode", "login-language-refresh");
    expect(screen.queryByTestId("mobile-subscription-offer")).not.toBeInTheDocument();

    await user.click(languageRefresh);

    expect(mocks.router.replace).toHaveBeenCalledWith("/?showOffer=1");
    expect(await screen.findByTestId("mobile-subscription-offer")).toBeInTheDocument();
    expect(mocks.resetTutorial).toHaveBeenCalledOnce();

    await user.click(screen.getByTestId("mobile-subscription-offer"));

    expect(mocks.activateTutorial).toHaveBeenCalledOnce();
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/"));
  });
});

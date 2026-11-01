import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileAuthGateway } from "@/features/auth/components/mobile-auth-gateway";

const mocks = vi.hoisted(() => ({
  activateTutorial: vi.fn(),
  deactivateTutorial: vi.fn(),
  resetTutorial: vi.fn(),
  clearUser: vi.fn(),
  authUser: { profile: { onboardingCompleted: true } } as { profile: { onboardingCompleted: boolean } } | null,
  isSessionReady: true,
  effectivePlan: "free" as "free" | "basic",
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
    user: mocks.authUser,
    isSessionReady: mocks.isSessionReady,
    refreshProfile: vi.fn(),
    updateProfileField: vi.fn(),
    clearUser: mocks.clearUser,
  }),
}));

vi.mock("@/features/subscriptions/subscription-client", () => ({
  useSubscription: () => ({
    entitlements: { effectivePlan: mocks.effectivePlan },
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

vi.mock("@/features/auth/components/mobile-google-auth-loading", () => ({
  MobileGoogleAuthLoading: () => <div data-testid="mobile-google-auth-loading" />,
}));

describe("MobileAuthGateway returning-login flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.replace.mockImplementation((href) => {
      window.history.replaceState({}, "", String(href));
    });
    window.sessionStorage.clear();
    mocks.authUser = { profile: { onboardingCompleted: true } };
    mocks.isSessionReady = true;
    mocks.effectivePlan = "free";
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
    expect(screen.queryByTestId("mobile-auth-screen")).not.toBeInTheDocument();
  });

  it("opens the mobile login screen when the logout redirect marker is present", async () => {
    mocks.authUser = null;
    window.history.replaceState({}, "", "/?mobile-gateway-login=1");

    render(<MobileAuthGateway countryCode="US" />);

    expect(await screen.findByTestId("mobile-auth-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-app-choice")).not.toBeInTheDocument();
  });

  it("does not let a stale logout marker override an authenticated user", async () => {
    window.history.replaceState({}, "", "/?mobile-gateway-login=1");
    mocks.authUser = { profile: { onboardingCompleted: false } };

    render(<MobileAuthGateway countryCode="US" />);

    expect(await screen.findByTestId("mobile-login-language-refresh")).toHaveAttribute(
      "data-onboarding-mode",
      "initial",
    );
    expect(screen.queryByTestId("mobile-auth-screen")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/"));
  });

  it("does not render the auth gateway for a completed authenticated user with a stale marker", async () => {
    window.history.replaceState({}, "", "/?mobile-gateway-login=1");

    render(<MobileAuthGateway countryCode="US" />);

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByTestId("mobile-auth-screen")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-login-language-refresh")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mobile-subscription-offer")).not.toBeInTheDocument();
  });

  it("keeps the OAuth callback loader above the stale logout marker", async () => {
    mocks.authUser = null;
    window.history.replaceState({}, "", "/?mobile-gateway-login=1");
    window.sessionStorage.setItem("foxiesdeck:google-auth-pending", String(Date.now()));

    render(<MobileAuthGateway countryCode="US" />);

    expect(await screen.findByTestId("mobile-google-auth-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-auth-screen")).not.toBeInTheDocument();
  });

  it("waits for session restoration before showing login over a stale logout marker", async () => {
    window.history.replaceState({}, "", "/?mobile-gateway-login=1");
    mocks.authUser = null;
    mocks.isSessionReady = false;

    const view = render(<MobileAuthGateway countryCode="US" />);

    expect(await screen.findByTestId("mobile-google-auth-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-auth-screen")).not.toBeInTheDocument();

    mocks.authUser = { profile: { onboardingCompleted: false } };
    mocks.isSessionReady = true;
    view.rerender(<MobileAuthGateway countryCode="US" />);

    expect(await screen.findByTestId("mobile-login-language-refresh")).toHaveAttribute(
      "data-onboarding-mode",
      "initial",
    );
    expect(screen.queryByTestId("mobile-auth-screen")).not.toBeInTheDocument();
  });

  it("keeps the offer visible while a successful purchase refreshes entitlements during exit", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/?showOffer=1");

    const view = render(<MobileAuthGateway countryCode="US" />);
    await user.click(await screen.findByTestId("mobile-subscription-offer"));

    mocks.effectivePlan = "basic";
    view.rerender(<MobileAuthGateway countryCode="US" />);

    expect(screen.getByTestId("mobile-subscription-offer")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-auth-screen")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByTestId("mobile-auth-screen")).not.toBeInTheDocument();
  });

  it("does not bounce back to login if the browser session is briefly pending after the free-offer exit", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/?showOffer=1");

    const view = render(<MobileAuthGateway countryCode="US" />);
    await user.click(await screen.findByTestId("mobile-subscription-offer"));

    mocks.authUser = null;
    mocks.isSessionReady = false;
    view.rerender(<MobileAuthGateway countryCode="US" />);

    expect(await screen.findByTestId("mobile-google-auth-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-auth-screen")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/"));

    mocks.authUser = { profile: { onboardingCompleted: true } };
    mocks.isSessionReady = true;
    view.rerender(<MobileAuthGateway countryCode="US" />);

    expect(screen.queryByTestId("mobile-auth-screen")).not.toBeInTheDocument();
  });

  it("server-renders the logout login screen before client hydration", () => {
    mocks.authUser = null;
    window.history.replaceState({}, "", "/?mobile-gateway-login=1");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1280,
    });

    const html = renderToString(<MobileAuthGateway countryCode="US" />);

    expect(html).toContain("data-mobile-auth-gateway");
    expect(html).toContain('data-testid="mobile-auth-screen"');
    expect(html).not.toContain("data-mobile-gateway-bootstrap");
  });

  it("forces the login screen and clears a stale Google-auth loading state after logout", async () => {
    mocks.authUser = null;
    window.history.replaceState({}, "", "/");
    window.sessionStorage.setItem("foxiesdeck:google-auth-pending", String(Date.now()));

    render(<MobileAuthGateway countryCode="US" />);

    expect(await screen.findByTestId("mobile-google-auth-loading")).toBeInTheDocument();

    window.dispatchEvent(new Event("foxiesdeck:mobile-logout-auth-requested"));

    expect(await screen.findByTestId("mobile-auth-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-google-auth-loading")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("foxiesdeck:google-auth-pending")).toBeNull();
    expect(mocks.deactivateTutorial).toHaveBeenCalled();
    expect(mocks.clearUser).toHaveBeenCalledOnce();
  });
});

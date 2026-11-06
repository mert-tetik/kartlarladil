import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileAuthGateway } from "@/features/auth/components/mobile-auth-gateway";
import { GATEWAY_FLOW_EXIT_DURATION_MS } from "@/features/auth/components/gateway-flow-transition";
import { SERIOUS_LEARNER_EXIT_UNMOUNT_DELAY_MS } from "@/features/auth/serious-learner-animation";
import { consumeSkippedRouteTransition } from "@/lib/route-transition";

const mocks = vi.hoisted(() => ({
  activateTutorial: vi.fn(),
  deactivateTutorial: vi.fn(),
  resetTutorial: vi.fn(),
  clearUser: vi.fn(),
  authUser: { profile: { onboardingCompleted: true } } as { profile: { onboardingCompleted: boolean } } | null,
  isSessionReady: true,
  pathname: "/",
  effectivePlan: "free" as "free" | "basic" | null,
  isEntitlementsLoading: false,
  router: {
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  },
}));

function mockGoogleAuthExitAnimationStyles() {
  vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
    animationName: "gateway-flow-item-exit",
    animationDuration: `${GATEWAY_FLOW_EXIT_DURATION_MS}ms`,
    animationDelay: "0s",
  }) as CSSStyleDeclaration);
}

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
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
    entitlements: mocks.effectivePlan ? { effectivePlan: mocks.effectivePlan } : null,
    isLoading: mocks.isEntitlementsLoading,
    error: null,
    refreshEntitlements: vi.fn(),
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
    <>
      <h2 data-gateway-flow-item data-gateway-flow-order="0">Native language</h2>
      <div data-gateway-flow-item data-gateway-flow-order="1">Language choices</div>
      <button
        data-gateway-flow-item
        data-gateway-flow-order="2"
        data-testid="mobile-login-language-refresh"
        data-onboarding-mode={mode ?? "initial"}
        onClick={onComplete}
        type="button"
      >
        Complete language choices
      </button>
    </>
  ),
}));

vi.mock("@/features/auth/components/mobile-subscription-offer-screen", () => ({
  MobileSubscriptionOfferScreen: ({
    isClosing,
    onContinueFree,
  }: {
    isClosing?: boolean;
    onContinueFree: () => void;
  }) => (
    <button
      className={isClosing ? "serious-learner-offer--closing" : undefined}
      data-testid="mobile-subscription-offer"
      onClick={onContinueFree}
      type="button"
    >
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
  MobileGoogleAuthLoading: () => (
    <div
      data-gateway-flow-screen
      data-gateway-flow-screen-exit
      data-testid="mobile-google-auth-loading"
    />
  ),
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
    mocks.pathname = "/";
    mocks.effectivePlan = "free";
    mocks.isEntitlementsLoading = false;
    window.history.replaceState({}, "", "/?mobileLanguageRefresh=1&showOffer=1");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
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

    expect(await screen.findByTestId("mobile-subscription-offer")).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.resetTutorial).toHaveBeenCalledOnce();

    await user.click(screen.getByTestId("mobile-subscription-offer"));

    expect(mocks.activateTutorial).toHaveBeenCalledOnce();
    await waitFor(
      () => expect(screen.queryByTestId("mobile-subscription-offer")).not.toBeInTheDocument(),
      { timeout: SERIOUS_LEARNER_EXIT_UNMOUNT_DELAY_MS + 500 },
    );
    expect(window.location.pathname).toBe("/");
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("mobile-auth-screen")).not.toBeInTheDocument();
  });

  it("shows the offer immediately after login completion while entitlements are unresolved", async () => {
    const user = userEvent.setup();
    mocks.effectivePlan = null;
    mocks.isEntitlementsLoading = true;
    window.history.replaceState({}, "", "/?mobileLanguageRefresh=1&showOffer=1");
    const view = render(<MobileAuthGateway countryCode="US" />);

    await user.click(await screen.findByTestId("mobile-login-language-refresh"));

    expect(await screen.findByTestId("mobile-subscription-offer")).toBeInTheDocument();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");

    mocks.effectivePlan = "free";
    mocks.isEntitlementsLoading = false;
    view.rerender(<MobileAuthGateway countryCode="US" />);

    expect(screen.getByTestId("mobile-subscription-offer")).toBeInTheDocument();
  });

  it("shows the offer immediately when onboarding completes before subscription data arrives", async () => {
    const user = userEvent.setup();
    mocks.authUser = { profile: { onboardingCompleted: false } };
    mocks.effectivePlan = null;
    mocks.isEntitlementsLoading = true;
    window.history.replaceState({}, "", "/");

    render(<MobileAuthGateway countryCode="US" />);

    await user.click(await screen.findByTestId("mobile-login-language-refresh"));

    expect(await screen.findByTestId("mobile-subscription-offer")).toBeInTheDocument();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("skips the offer for a known paid user and resumes the tutorial flow", async () => {
    const user = userEvent.setup();
    mocks.effectivePlan = "basic";
    window.history.replaceState({}, "", "/?mobileLanguageRefresh=1&showOffer=1");

    render(<MobileAuthGateway countryCode="US" />);

    await user.click(await screen.findByTestId("mobile-login-language-refresh"));

    await waitFor(() => expect(mocks.activateTutorial).toHaveBeenCalledOnce());
    expect(screen.queryByTestId("mobile-subscription-offer")).not.toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("does not show the serious-learner offer later without a login-flow trigger", () => {
    window.history.replaceState({}, "", "/");

    render(<MobileAuthGateway countryCode="US" />);

    expect(screen.queryByTestId("mobile-subscription-offer")).not.toBeInTheDocument();
  });

  it("plays the shared serious-learner exit animation in visual-test mode before reopening", () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?serious-learner-test=1");

    render(<MobileAuthGateway countryCode="US" />);

    const offer = screen.getByTestId("mobile-subscription-offer");
    expect(offer.closest("[data-mobile-auth-gateway]")).toHaveClass("bg-transparent", "z-[220]");
    fireEvent.click(offer);

    expect(offer).toHaveClass("serious-learner-offer--closing");
    act(() => {
      vi.advanceTimersByTime(SERIOUS_LEARNER_EXIT_UNMOUNT_DELAY_MS - 1);
    });
    expect(offer).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId("mobile-subscription-offer")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.queryByTestId("mobile-subscription-offer")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("mobile-subscription-offer")).toBeInTheDocument();
  });

  it("skips the landing entrance when the auth gateway exits to the home route", async () => {
    const user = userEvent.setup();
    mocks.pathname = "/login";
    window.history.replaceState({}, "", "/login?showOffer=1");
    render(<MobileAuthGateway countryCode="US" />);

    await user.click(await screen.findByTestId("mobile-subscription-offer"));
    await waitFor(
      () => expect(mocks.router.replace).toHaveBeenCalledWith("/"),
      { timeout: SERIOUS_LEARNER_EXIT_UNMOUNT_DELAY_MS + 500 },
    );

    expect(consumeSkippedRouteTransition("/")).toBe(true);
  });

  it("opens the mobile login screen when the logout redirect marker is present", async () => {
    mocks.authUser = null;
    window.history.replaceState({}, "", "/?mobile-gateway-login=1");

    render(<MobileAuthGateway countryCode="US" />);

    expect(await screen.findByTestId("mobile-auth-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-app-choice")).not.toBeInTheDocument();
  });

  it("fades the opaque gateway backdrop before removing the overlay after login", () => {
    vi.useFakeTimers();
    mocks.authUser = null;
    window.history.replaceState({}, "", "/?mobile-gateway-login=1");
    const view = render(<MobileAuthGateway countryCode="US" />);

    expect(screen.getByTestId("mobile-auth-screen")).toBeInTheDocument();

    mocks.authUser = { profile: { onboardingCompleted: true } };
    view.rerender(<MobileAuthGateway countryCode="US" />);

    const gateway = document.querySelector<HTMLElement>("[data-mobile-auth-gateway]");
    expect(gateway).toHaveAttribute("data-gateway-shell-closing", "true");
    expect(gateway).toHaveAttribute("data-gateway-shell-opaque", "true");
    expect(gateway?.querySelector("[data-gateway-shell-backdrop]")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(GATEWAY_FLOW_EXIT_DURATION_MS + 49);
    });
    expect(document.querySelector("[data-mobile-auth-gateway]")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(document.querySelector("[data-mobile-auth-gateway]")).not.toBeInTheDocument();
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
    await waitFor(
      () => expect(window.location.search).toBe(""),
      { timeout: SERIOUS_LEARNER_EXIT_UNMOUNT_DELAY_MS + 500 },
    );
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("does not render the auth gateway for a completed authenticated user with a stale marker", async () => {
    window.history.replaceState({}, "", "/?mobile-gateway-login=1");

    render(<MobileAuthGateway countryCode="US" />);

    await waitFor(() => expect(window.location.search).toBe(""));
    expect(mocks.router.replace).not.toHaveBeenCalled();
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

  it("waits for the Google verification scale-out to finish before staging onboarding from top to bottom", () => {
    vi.useFakeTimers();
    mockGoogleAuthExitAnimationStyles();
    mocks.authUser = null;
    mocks.isSessionReady = false;
    window.history.replaceState({}, "", "/");

    const view = render(<MobileAuthGateway countryCode="US" />);
    const verificationScreen = screen.getByTestId("mobile-google-auth-loading");

    mocks.authUser = { profile: { onboardingCompleted: false } };
    mocks.isSessionReady = true;
    view.rerender(<MobileAuthGateway countryCode="US" />);

    const exitingTransition = verificationScreen.closest("[data-gateway-flow-phase]");
    expect(exitingTransition).toHaveAttribute("data-gateway-flow-phase", "exit");
    expect(screen.queryByTestId("mobile-login-language-refresh")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(GATEWAY_FLOW_EXIT_DURATION_MS - 1);
    });
    expect(verificationScreen).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-login-language-refresh")).not.toBeInTheDocument();

    act(() => {
      const animationEndEvent = new Event("animationend", { bubbles: true });
      Object.defineProperty(animationEndEvent, "animationName", {
        value: "gateway-flow-item-exit",
      });
      verificationScreen.dispatchEvent(animationEndEvent);
    });

    const onboardingAction = screen.getByTestId("mobile-login-language-refresh");
    expect(verificationScreen).not.toBeInTheDocument();
    expect(onboardingAction.closest("[data-gateway-flow-phase]")?.querySelectorAll("[data-gateway-flow-item]")).toHaveLength(3);
    expect(
      Array.from(
        onboardingAction.closest("[data-gateway-flow-phase]")?.querySelectorAll<HTMLElement>("[data-gateway-flow-item]") ?? [],
        (item) => item.dataset.gatewayFlowOrder,
      ),
    ).toEqual(["0", "1", "2"]);
  });

  it("falls back to the exit timeout if the browser never dispatches animationend", () => {
    vi.useFakeTimers();
    mockGoogleAuthExitAnimationStyles();
    mocks.authUser = null;
    mocks.isSessionReady = false;
    window.history.replaceState({}, "", "/");

    const view = render(<MobileAuthGateway countryCode="US" />);
    const verificationScreen = screen.getByTestId("mobile-google-auth-loading");

    mocks.authUser = { profile: { onboardingCompleted: false } };
    mocks.isSessionReady = true;
    view.rerender(<MobileAuthGateway countryCode="US" />);

    act(() => {
      vi.advanceTimersByTime(GATEWAY_FLOW_EXIT_DURATION_MS + 100);
    });

    expect(verificationScreen).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-login-language-refresh")).toBeInTheDocument();
  });

  it("keeps the offer visible while a successful purchase refreshes entitlements during exit", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/?showOffer=1");

    const view = render(<MobileAuthGateway countryCode="US" />);
    await user.click(await screen.findByTestId("mobile-subscription-offer"));

    mocks.effectivePlan = "basic";
    view.rerender(<MobileAuthGateway countryCode="US" />);

    expect(screen.getByTestId("mobile-subscription-offer")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-subscription-offer")).toHaveClass("serious-learner-offer--closing");
    expect(screen.queryByTestId("mobile-auth-screen")).not.toBeInTheDocument();
    await waitFor(
      () => expect(screen.queryByTestId("mobile-subscription-offer")).not.toBeInTheDocument(),
      { timeout: SERIOUS_LEARNER_EXIT_UNMOUNT_DELAY_MS + 500 },
    );
    expect(mocks.router.replace).not.toHaveBeenCalled();
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
    await waitFor(
      () => expect(window.location.search).toBe(""),
      { timeout: SERIOUS_LEARNER_EXIT_UNMOUNT_DELAY_MS + 500 },
    );
    expect(mocks.router.replace).not.toHaveBeenCalled();

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

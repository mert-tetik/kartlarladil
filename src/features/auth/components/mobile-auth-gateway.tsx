"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MobileAppChoiceScreen } from "@/features/auth/components/mobile-app-choice-screen";
import { MobileAuthScreen } from "@/features/auth/components/mobile-auth-screen";
import { MobileOnboardingForm } from "@/features/auth/components/mobile-onboarding-form";
import { MobileSubscriptionOfferScreen } from "@/features/auth/components/mobile-subscription-offer-screen";
import { useAuthSession } from "@/features/auth/auth-client";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { shouldKeepMobileGatewayBootstrapVisible } from "@/features/auth/mobile-gateway-bootstrap";
import {
  initTwaModeStore,
  isInstalledApp,
  isIosMobileTestMode,
  isMobileTestMode,
} from "@/features/install-app/twa-mode";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { cn } from "@/lib/utils";

const BOOTSTRAP_EXIT_DURATION_MS = 320;

type BootstrapPhase = "visible" | "exiting" | "hidden";

function MobileGatewayBootstrap({ phase }: { phase: Exclude<BootstrapPhase, "hidden"> }) {
  return (
    <div
      aria-busy="true"
      className={cn(
        "fixed inset-0 z-[210] flex items-center justify-center bg-[#f76808] px-8 text-white transition-[opacity,transform] duration-300 ease-out lg:hidden",
        phase === "exiting" && "pointer-events-none -translate-y-3 opacity-0",
      )}
      data-mobile-gateway-bootstrap
      role="status"
    >
      <div className="h-12 w-72 max-w-full overflow-hidden">
        <Image
          alt="FoxiesDeck"
          className="h-auto w-full -translate-y-[40%]"
          height={1024}
          priority
          src="/splash.png"
          width={1024}
        />
      </div>
    </div>
  );
}

function OnboardingBackground() {
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-0 h-1/2 overflow-hidden">
      <div
        className="absolute inset-0 bg-[url('/onboarding-bg.jpg')] bg-cover bg-bottom bg-no-repeat"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-background to-transparent"
        aria-hidden="true"
      />
    </div>
  );
}

function GatewayShell({
  children,
  isTestMode,
  centered = false,
  showBackground = true,
}: {
  children: ReactNode;
  isTestMode: boolean;
  centered?: boolean;
  showBackground?: boolean;
}) {
  return (
    <div
      data-mobile-auth-gateway
      className={cn(
        "fixed inset-0 z-[100] isolate overflow-hidden bg-background",
        !isTestMode && "max-lg:block lg:hidden",
      )}
    >
      {showBackground ? <OnboardingBackground /> : null}
      <div className={cn(
        "relative z-10 flex min-h-full w-full justify-center px-6",
        centered
          ? "items-center py-[max(1.5rem,env(safe-area-inset-bottom))]"
          : "items-end pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8",
      )}>
        <div className="flex w-full justify-center">
          {children}
        </div>
      </div>
    </div>
  );
}

const WEB_CHOICE_KEY = "foxiesdeck:mobile-web-choice";
const LOGOUT_AUTH_KEY = "foxiesdeck:mobile-logout-auth";
const LOGOUT_AUTH_EVENT = "foxiesdeck:mobile-logout-auth-requested";
const MOBILE_LOGIN_TUTORIAL_RESET_KEY = "foxiesdeck:mobile-login-tutorial-reset-requested";
const MOBILE_BREAKPOINT = 1024;

const PUBLIC_MOBILE_PATHS = ["/add-to-home-screen", "/content-automation"];

function getIsMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function readWebChoice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.sessionStorage.getItem(WEB_CHOICE_KEY) === "true" ||
    window.sessionStorage.getItem(LOGOUT_AUTH_KEY) === "1"
  );
}

function saveWebChoice() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WEB_CHOICE_KEY, "true");
}

export function MobileAuthGateway({ countryCode }: { countryCode: string | null }) {
  const { user } = useAuthSession();
  const { entitlements, isLoading: isEntitlementsLoading } = useSubscription();
  const activateTutorial = useTutorialStore((state) => state.activate);
  const deactivateTutorial = useTutorialStore((state) => state.deactivate);
  const resetTutorial = useTutorialStore((state) => state.reset);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [hasChosenWeb, setHasChosenWeb] = useState(() =>
    isIosMobileTestMode() ? false : readWebChoice(),
  );
  const [onboardingCompletedInSession, setOnboardingCompletedInSession] = useState(false);
  const [offerTriggered, setOfferTriggered] = useState(false);
  const [offerSeen, setOfferSeen] = useState(false);
  const [offerActive, setOfferActive] = useState(false);
  const [bootstrapPhase, setBootstrapPhase] = useState<BootstrapPhase>("visible");
  const bootstrapFinishedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    initTwaModeStore();

    function handleResize() {
      setIsMobileViewport(getIsMobileViewport);
    }

    function handleLogoutAuthRequested() {
      deactivateTutorial();
      setHasChosenWeb(true);
      setOfferActive(false);
      setOfferTriggered(false);
      setOfferSeen(false);
      setOnboardingCompletedInSession(false);
      window.sessionStorage.removeItem(MOBILE_LOGIN_TUTORIAL_RESET_KEY);
    }

    window.addEventListener("resize", handleResize);
    window.addEventListener(LOGOUT_AUTH_EVENT, handleLogoutAuthRequested);

    if (window.sessionStorage.getItem(LOGOUT_AUTH_KEY) === "1") {
      window.sessionStorage.removeItem(LOGOUT_AUTH_KEY);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener(LOGOUT_AUTH_EVENT, handleLogoutAuthRequested);
    };
  }, []);

  const hasCompletedOnboarding = Boolean(
    user?.profile.onboardingCompleted || onboardingCompletedInSession,
  );
  const needsOnboarding = Boolean(user && !hasCompletedOnboarding);
  const isAlreadySubscribed =
    !isEntitlementsLoading && entitlements?.effectivePlan != null && entitlements.effectivePlan !== "free";
  const isOfferTriggered = searchParams.get("showOffer") === "1" || offerTriggered;
  const isRankUpTestMode = searchParams.get("rank-up-test") === "1" || searchParams.get("rank-up-test") === "true";
  const isOfferEligible = Boolean(
    user &&
    hasCompletedOnboarding &&
    !offerSeen &&
    !isEntitlementsLoading &&
    isOfferTriggered &&
    !isAlreadySubscribed,
  );
  const needsAuth = !user;

  useEffect(() => {
    if (!mounted || !user || !hasCompletedOnboarding) return;

    const shouldResetTutorial =
      window.sessionStorage.getItem(MOBILE_LOGIN_TUTORIAL_RESET_KEY) === "1";
    if (!shouldResetTutorial) return;

    resetTutorial();
    activateTutorial();
    window.sessionStorage.removeItem(MOBILE_LOGIN_TUTORIAL_RESET_KEY);
  }, [mounted, user, hasCompletedOnboarding, activateTutorial, resetTutorial]);

  useEffect(() => {
    if (isOfferEligible) {
      setOfferActive(true);
    }
  }, [isOfferEligible]);

  useEffect(() => {
    if (!user || offerSeen || isAlreadySubscribed) {
      setOfferActive(false);
    }
    if (!user) {
      deactivateTutorial();
      setOnboardingCompletedInSession(false);
      setOfferTriggered(false);
      setOfferSeen(false);
    }
  }, [user, offerSeen, isAlreadySubscribed, deactivateTutorial]);

  const shouldShowOffer = isOfferEligible || offerActive;

  const isPublicMobilePath = PUBLIC_MOBILE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  const isTestMode = isMobileTestMode();
  const isIosTestMode = isIosMobileTestMode();
  const showGateway =
    isTestMode ||
    (isMobileViewport && (needsAuth || needsOnboarding || shouldShowOffer));

  const shouldKeepBootstrapVisible = shouldKeepMobileGatewayBootstrapVisible({
    mounted,
    isMobileViewport,
    isPublicMobilePath,
    isRankUpTestMode,
    isOfferTriggered,
    isEntitlementsLoading,
  });

  useEffect(() => {
    if (bootstrapFinishedRef.current) return;

    if (shouldKeepBootstrapVisible) {
      const resumeFrame = window.requestAnimationFrame(() => setBootstrapPhase("visible"));
      return () => window.cancelAnimationFrame(resumeFrame);
    }

    const exitFrame = window.requestAnimationFrame(() => setBootstrapPhase("exiting"));
    const finishTimer = window.setTimeout(() => {
      bootstrapFinishedRef.current = true;
      setBootstrapPhase("hidden");
    }, BOOTSTRAP_EXIT_DURATION_MS);

    return () => {
      window.cancelAnimationFrame(exitFrame);
      window.clearTimeout(finishTimer);
    };
  }, [shouldKeepBootstrapVisible]);

  const isInstalled = isInstalledApp() && !isTestMode;

  function handleContinueOnWeb() {
    saveWebChoice();
    setHasChosenWeb(true);
  }

  function handleOnboardingComplete() {
    // Start immediately and persist the unfinished flow in case the app closes here.
    resetTutorial();
    activateTutorial();
    setOnboardingCompletedInSession(true);
    setOfferTriggered(true);
    setOfferActive(true);
  }

  function handleContinueFree() {
    setOfferSeen(true);
    setOfferActive(false);
    setOfferTriggered(false);
    router.replace("/");
  }

  let gateway: ReactNode = null;

  if (mounted && showGateway && !isPublicMobilePath && !isRankUpTestMode) {
    if (isIosTestMode && !hasChosenWeb) {
      gateway = (
      <GatewayShell isTestMode={isTestMode}>
        <MobileAppChoiceScreen
          forceApple
          onContinueOnWeb={handleContinueOnWeb}
        />
      </GatewayShell>
      );
    } else if (shouldShowOffer) {
      gateway = (
      <GatewayShell isTestMode={isTestMode}>
        <MobileSubscriptionOfferScreen onContinueFree={handleContinueFree} />
      </GatewayShell>
      );
    } else if (needsOnboarding) {
      gateway = (
      <GatewayShell isTestMode={isTestMode} centered showBackground={false}>
        <MobileOnboardingForm countryCode={countryCode} onComplete={handleOnboardingComplete} />
      </GatewayShell>
      );
    } else if (!isInstalled && !hasChosenWeb) {
      gateway = (
      <GatewayShell isTestMode={isTestMode}>
        <MobileAppChoiceScreen onContinueOnWeb={handleContinueOnWeb} />
      </GatewayShell>
      );
    } else {
      gateway = (
        <GatewayShell isTestMode={isTestMode}>
          <MobileAuthScreen />
        </GatewayShell>
      );
    }
  }

  return (
    <>
      {gateway}
      {bootstrapPhase === "hidden" ? null : <MobileGatewayBootstrap phase={bootstrapPhase} />}
    </>
  );
}

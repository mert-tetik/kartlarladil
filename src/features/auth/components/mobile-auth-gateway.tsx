"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MobileAppChoiceScreen } from "@/features/auth/components/mobile-app-choice-screen";
import { MobileAuthScreen } from "@/features/auth/components/mobile-auth-screen";
import { MobileOnboardingForm } from "@/features/auth/components/mobile-onboarding-form";
import { MobileSubscriptionOfferScreen } from "@/features/auth/components/mobile-subscription-offer-screen";
import { useAuthSession } from "@/features/auth/auth-client";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { initTwaModeStore, isInstalledApp, isMobileTestMode } from "@/features/install-app/twa-mode";
import { cn } from "@/lib/utils";

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
}: {
  children: ReactNode;
  isTestMode: boolean;
}) {
  return (
    <div
      data-mobile-auth-gateway
      className={cn(
        "fixed inset-0 z-[100] isolate overflow-hidden bg-background",
        !isTestMode && "max-lg:block lg:hidden",
      )}
    >
      <OnboardingBackground />
      <div className="relative z-10 flex min-h-full w-full items-end justify-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
        <div className="flex w-full justify-center">
          {children}
        </div>
      </div>
    </div>
  );
}

const WEB_CHOICE_KEY = "foxiesdeck:mobile-web-choice";
const SUBSCRIPTION_OFFER_KEY = "foxiesdeck:mobile-subscription-offer-seen";
const MOBILE_BREAKPOINT = 1024;

const PUBLIC_MOBILE_PATHS = ["/add-to-home-screen"];

function getIsMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function readWebChoice(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(WEB_CHOICE_KEY) === "true";
}

function saveWebChoice() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(WEB_CHOICE_KEY, "true");
}

function readOfferSeen(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SUBSCRIPTION_OFFER_KEY) === "true";
}

function saveOfferSeen() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SUBSCRIPTION_OFFER_KEY, "true");
}

export function MobileAuthGateway() {
  const { user } = useAuthSession();
  const { entitlements, isLoading: isEntitlementsLoading } = useSubscription();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [hasChosenWeb, setHasChosenWeb] = useState(readWebChoice);
  const [offerTriggered, setOfferTriggered] = useState(false);
  const [offerSeen, setOfferSeen] = useState(readOfferSeen);

  useEffect(() => {
    setMounted(true);
    initTwaModeStore();

    function handleResize() {
      setIsMobileViewport(getIsMobileViewport);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const needsOnboarding = user && !user.profile.onboardingCompleted;
  const isAlreadySubscribed =
    !isEntitlementsLoading && entitlements?.effectivePlan != null && entitlements.effectivePlan !== "free";
  const isOfferTriggered = searchParams.get("showOffer") === "1" || offerTriggered;
  const isOfferEligible =
    user &&
    user.profile.onboardingCompleted &&
    !offerSeen &&
    isOfferTriggered &&
    !isAlreadySubscribed;
  const needsAuth = !user;

  const isPublicMobilePath = PUBLIC_MOBILE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  const isTestMode = isMobileTestMode();
  const showGateway =
    isTestMode ||
    (isMobileViewport && (needsAuth || needsOnboarding || isOfferEligible));

  if (!mounted || !showGateway || isPublicMobilePath) {
    return null;
  }

  const isInstalled = isInstalledApp() && !isTestMode;

  function handleContinueOnWeb() {
    saveWebChoice();
    setHasChosenWeb(true);
  }

  function handleOnboardingComplete() {
    setOfferTriggered(true);
  }

  function handleContinueFree() {
    saveOfferSeen();
    setOfferSeen(true);
    setOfferTriggered(false);
  }

  if (isOfferEligible) {
    return (
      <GatewayShell isTestMode={isTestMode}>
        <MobileSubscriptionOfferScreen onContinueFree={handleContinueFree} />
      </GatewayShell>
    );
  }

  if (needsOnboarding) {
    return (
      <GatewayShell isTestMode={isTestMode}>
        <MobileOnboardingForm onComplete={handleOnboardingComplete} />
      </GatewayShell>
    );
  }

  if (!isInstalled && !hasChosenWeb) {
    return (
      <GatewayShell isTestMode={isTestMode}>
        <MobileAppChoiceScreen onContinueOnWeb={handleContinueOnWeb} />
      </GatewayShell>
    );
  }

  return (
    <GatewayShell isTestMode={isTestMode}>
      <MobileAuthScreen />
    </GatewayShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MobileAppChoiceScreen } from "@/features/auth/components/mobile-app-choice-screen";
import { MobileAuthScreen } from "@/features/auth/components/mobile-auth-screen";
import { MobileOnboardingForm } from "@/features/auth/components/mobile-onboarding-form";
import { useAuthSession } from "@/features/auth/auth-client";
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

const WEB_CHOICE_KEY = "foxiesdeck:mobile-web-choice";
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

export function MobileAuthGateway() {
  const { user } = useAuthSession();
  const pathname = usePathname();
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [hasChosenWeb, setHasChosenWeb] = useState(readWebChoice);

  useEffect(() => {
    initTwaModeStore();

    function handleResize() {
      setIsMobileViewport(getIsMobileViewport);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const needsAuth = useMemo(() => {
    if (!user) return true;
    return !user.profile.onboardingCompleted;
  }, [user]);

  const isPublicMobilePath = PUBLIC_MOBILE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  const isTestMode = isMobileTestMode();
  const showGateway = isTestMode || (isMobileViewport && needsAuth);

  if (!showGateway || isPublicMobilePath) {
    return null;
  }

  const isInstalled = isInstalledApp() && !isTestMode;

  function handleContinueOnWeb() {
    saveWebChoice();
    setHasChosenWeb(true);
  }

  if (!isInstalled && !hasChosenWeb) {
    return (
      <div
        data-mobile-auth-gateway
        className={cn(
          "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-6",
          !isTestMode && "max-lg:flex lg:hidden",
        )}
      >
        <OnboardingBackground />
        <MobileAppChoiceScreen onContinueOnWeb={handleContinueOnWeb} />
      </div>
    );
  }

  if (user && !user.profile.onboardingCompleted) {
    return (
      <div
        data-mobile-auth-gateway
        className={cn(
          "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-6",
          !isTestMode && "max-lg:flex lg:hidden",
        )}
      >
        <OnboardingBackground />
        <MobileOnboardingForm />
      </div>
    );
  }

  return (
    <div
      data-mobile-auth-gateway
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background p-6",
        !isTestMode && "max-lg:flex lg:hidden",
      )}
    >
      <OnboardingBackground />
      <MobileAuthScreen />
    </div>
  );
}

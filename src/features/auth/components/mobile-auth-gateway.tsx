"use client";

import type { ReactNode } from "react";
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
  const [mounted, setMounted] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [hasChosenWeb, setHasChosenWeb] = useState(readWebChoice);

  useEffect(() => {
    setMounted(true);
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

  if (!mounted || !showGateway || isPublicMobilePath) {
    return null;
  }

  const isInstalled = isInstalledApp() && !isTestMode;

  function handleContinueOnWeb() {
    saveWebChoice();
    setHasChosenWeb(true);
  }

  if (!isInstalled && !hasChosenWeb) {
    return (
      <GatewayShell isTestMode={isTestMode}>
        <MobileAppChoiceScreen onContinueOnWeb={handleContinueOnWeb} />
      </GatewayShell>
    );
  }

  if (user && !user.profile.onboardingCompleted) {
    return (
      <GatewayShell isTestMode={isTestMode}>
        <MobileOnboardingForm />
      </GatewayShell>
    );
  }

  return (
    <GatewayShell isTestMode={isTestMode}>
      <MobileAuthScreen />
    </GatewayShell>
  );
}

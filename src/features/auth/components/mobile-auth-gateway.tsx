"use client";

import { useEffect, useMemo, useState } from "react";
import { MobileAppChoiceScreen } from "@/features/auth/components/mobile-app-choice-screen";
import { MobileAuthScreen } from "@/features/auth/components/mobile-auth-screen";
import { MobileOnboardingForm } from "@/features/auth/components/mobile-onboarding-form";
import { useAuthSession } from "@/features/auth/auth-client";
import { initTwaModeStore, isInstalledApp } from "@/features/install-app/twa-mode";
import { cn } from "@/lib/utils";

const WEB_CHOICE_KEY = "foxiesdeck:mobile-web-choice";
const MOBILE_BREAKPOINT = 1024;

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

  if (!isMobileViewport || !needsAuth) {
    return null;
  }

  const isInstalled = isInstalledApp();

  function handleContinueOnWeb() {
    saveWebChoice();
    setHasChosenWeb(true);
  }

  if (!isInstalled && !hasChosenWeb) {
    return (
      <div
        data-mobile-auth-gateway
        className={cn(
          "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white p-6",
          "max-lg:flex lg:hidden",
        )}
      >
        <MobileAppChoiceScreen onContinueOnWeb={handleContinueOnWeb} />
      </div>
    );
  }

  if (user && !user.profile.onboardingCompleted) {
    return (
      <div
        data-mobile-auth-gateway
        className={cn(
          "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white p-6",
          "max-lg:flex lg:hidden",
        )}
      >
        <MobileOnboardingForm />
      </div>
    );
  }

  return (
    <div
      data-mobile-auth-gateway
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white p-6",
        "max-lg:flex lg:hidden",
      )}
    >
      <MobileAuthScreen />
    </div>
  );
}

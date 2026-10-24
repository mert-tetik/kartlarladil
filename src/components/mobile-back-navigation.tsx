"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getMobileNavbarBackOverride,
  requestMobileNavbarBack,
} from "@/components/mobile-navbar-back";
import { navigateWithRouteTransition } from "@/lib/route-transition";

const ANDROID_BACK_HANDLER = "__foxiesDeckHandleAndroidBack";

declare global {
  interface Window {
    [ANDROID_BACK_HANDLER]?: () => boolean;
  }
}

function getVisibleMobileCloseButton(): HTMLButtonElement | null {
  if (typeof document === "undefined") return null;

  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-mobile-back-close]"),
  );

  for (const button of buttons.reverse()) {
    if (button.disabled || button.closest('[aria-hidden="true"]')) continue;

    const computedStyle = window.getComputedStyle(button);
    if (computedStyle.display === "none" || computedStyle.visibility === "hidden") continue;

    return button;
  }

  return null;
}

/**
 * Bridges the Android system back action to the app's mobile navigation rules.
 * The native WebView calls this synchronously and closes the Activity only
 * when the function returns false.
 */
export function MobileBackNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const handleAndroidBack = () => {
      const closeButton = getVisibleMobileCloseButton();
      if (closeButton) {
        closeButton.click();
        return true;
      }

      if (getMobileNavbarBackOverride()) {
        requestMobileNavbarBack();
        return true;
      }

      if (pathnameRef.current !== "/") {
        navigateWithRouteTransition(() => router.push("/"));
        return true;
      }

      return false;
    };

    window[ANDROID_BACK_HANDLER] = handleAndroidBack;

    return () => {
      if (window[ANDROID_BACK_HANDLER] === handleAndroidBack) {
        delete window[ANDROID_BACK_HANDLER];
      }
    };
  }, [router]);

  return null;
}

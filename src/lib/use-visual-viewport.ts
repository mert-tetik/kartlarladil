"use client";

import { useEffect, useSyncExternalStore } from "react";

const KEYBOARD_HEIGHT_VAR = "--keyboard-height";
const MOBILE_NAV_HEIGHT = 64;

function readSafeAreaBottom(): number {
  if (typeof document === "undefined") return 0;
  const value = getComputedStyle(document.documentElement).getPropertyValue(
    "--mobile-nav-filler-height",
  );
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readKeyboardHeight(): number {
  if (typeof window === "undefined" || !window.visualViewport) return 0;
  const vv = window.visualViewport;
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}

function subscribeToVisualViewport(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.visualViewport) {
    return () => {};
  }
  const vv = window.visualViewport;
  vv.addEventListener("resize", callback);
  vv.addEventListener("scroll", callback);
  window.addEventListener("resize", callback);
  return () => {
    vv.removeEventListener("resize", callback);
    vv.removeEventListener("scroll", callback);
    window.removeEventListener("resize", callback);
  };
}

export function useVisualViewport() {
  const keyboardHeight = useSyncExternalStore(
    subscribeToVisualViewport,
    readKeyboardHeight,
    () => 0,
  );
  const safeAreaBottom = useSyncExternalStore(
    subscribeToVisualViewport,
    readSafeAreaBottom,
    () => 0,
  );

  useEffect(() => {
    if (keyboardHeight > 0) {
      document.documentElement.style.setProperty(
        KEYBOARD_HEIGHT_VAR,
        `${keyboardHeight}px`,
      );
    }
    return () => {
      document.documentElement.style.removeProperty(KEYBOARD_HEIGHT_VAR);
    };
  }, [keyboardHeight]);

  return { keyboardHeight, safeAreaBottom, navHeight: MOBILE_NAV_HEIGHT };
}

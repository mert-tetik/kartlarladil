"use client";

import { useEffect, useRef, useState } from "react";

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

function readInitialKeyboardHeight(): number {
  if (typeof window === "undefined" || !window.visualViewport) return 0;
  return Math.max(
    0,
    window.innerHeight -
      window.visualViewport.height -
      window.visualViewport.offsetTop,
  );
}

export function useVisualViewport() {
  const baselineRef = useRef(
    typeof window !== "undefined" ? window.innerHeight : 0,
  );
  const lastWidthRef = useRef(
    typeof window !== "undefined" ? window.innerWidth : 0,
  );

  const [keyboardHeight, setKeyboardHeight] = useState(readInitialKeyboardHeight);
  const [safeAreaBottom, setSafeAreaBottom] = useState(() =>
    typeof document !== "undefined" ? readSafeAreaBottom() : 0,
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    const vv = window.visualViewport;

    function syncKeyboardHeight() {
      if (!vv) return;
      const nextKeyboardHeight = Math.max(
        0,
        baselineRef.current - vv.height - vv.offsetTop,
      );
      setKeyboardHeight(nextKeyboardHeight);
    }

    function handleWindowResize() {
      const widthChanged = window.innerWidth !== lastWidthRef.current;
      if (widthChanged) {
        baselineRef.current = window.innerHeight;
        lastWidthRef.current = window.innerWidth;
      }
      setSafeAreaBottom(readSafeAreaBottom());
      syncKeyboardHeight();
    }

    vv.addEventListener("resize", syncKeyboardHeight);
    vv.addEventListener("scroll", syncKeyboardHeight);
    window.addEventListener("resize", handleWindowResize);

    return () => {
      vv.removeEventListener("resize", syncKeyboardHeight);
      vv.removeEventListener("scroll", syncKeyboardHeight);
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

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

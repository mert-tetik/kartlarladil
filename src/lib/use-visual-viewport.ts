"use client";

import { useEffect, useRef } from "react";

const KEYBOARD_HEIGHT_VAR = "--keyboard-height";

export function useVisualViewport() {
  const baselineRef = useRef(0);
  const lastWidthRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    const vv = window.visualViewport;
    baselineRef.current = window.innerHeight;
    lastWidthRef.current = window.innerWidth;

    function syncKeyboardHeight() {
      if (!vv) return;
      const keyboardHeight = Math.max(
        0,
        baselineRef.current - vv.height - vv.offsetTop,
      );
      document.documentElement.style.setProperty(
        KEYBOARD_HEIGHT_VAR,
        `${keyboardHeight}px`,
      );
    }

    function handleWindowResize() {
      const widthChanged = window.innerWidth !== lastWidthRef.current;
      if (widthChanged) {
        baselineRef.current = window.innerHeight;
        lastWidthRef.current = window.innerWidth;
      }
      syncKeyboardHeight();
    }

    syncKeyboardHeight();
    vv.addEventListener("resize", syncKeyboardHeight);
    vv.addEventListener("scroll", syncKeyboardHeight);
    window.addEventListener("resize", handleWindowResize);

    return () => {
      vv.removeEventListener("resize", syncKeyboardHeight);
      vv.removeEventListener("scroll", syncKeyboardHeight);
      window.removeEventListener("resize", handleWindowResize);
      document.documentElement.style.removeProperty(KEYBOARD_HEIGHT_VAR);
    };
  }, []);
}

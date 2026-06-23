"use client";

import { useLayoutEffect } from "react";
import { useMobileKeyboardDock } from "@/lib/use-mobile-keyboard-dock";

const KEYBOARD_ATTRIBUTE = "data-mobile-keyboard-open";
const KEYBOARD_OFFSET_VAR = "--mobile-keyboard-offset";

export function MobileViewportController() {
  const { isKeyboardOpen, keyboardOffset } = useMobileKeyboardDock();

  useLayoutEffect(() => {
    const root = document.documentElement;

    root.setAttribute(KEYBOARD_ATTRIBUTE, String(isKeyboardOpen));
    root.style.setProperty(KEYBOARD_OFFSET_VAR, `${keyboardOffset}px`);

    return () => {
      root.removeAttribute(KEYBOARD_ATTRIBUTE);
      root.style.removeProperty(KEYBOARD_OFFSET_VAR);
    };
  }, [isKeyboardOpen, keyboardOffset]);

  return null;
}

"use client";

import { useLayoutEffect, useRef, useState } from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 1023px)";
const DEFAULT_KEYBOARD_THRESHOLD = 80;

export type MobileKeyboardDockState = {
  isKeyboardOpen: boolean;
  isMobileViewport: boolean;
  keyboardOffset: number;
};

function isEditableElement(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return !element.disabled;
  }

  if (element instanceof HTMLInputElement) {
    return !element.disabled && !element.readOnly;
  }

  return element instanceof HTMLElement && element.isContentEditable;
}

export function useMobileKeyboardDock(
  keyboardThreshold = DEFAULT_KEYBOARD_THRESHOLD,
): MobileKeyboardDockState {
  const maxMobileViewportHeightRef = useRef(0);
  const keyboardOpenRef = useRef(false);
  const [state, setState] = useState<MobileKeyboardDockState>({
    isKeyboardOpen: false,
    isMobileViewport: false,
    keyboardOffset: 0,
  });

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery =
      typeof window.matchMedia === "function" ? window.matchMedia(MOBILE_MEDIA_QUERY) : null;
    const visualViewport = window.visualViewport;

    function syncState() {
      const isMobileViewport = mediaQuery?.matches ?? window.innerWidth < 1024;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const viewportOffsetTop = visualViewport?.offsetTop ?? 0;
      const visibleViewportBottom = viewportHeight + viewportOffsetTop;
      const currentViewportHeight = Math.max(window.innerHeight, visibleViewportBottom);
      const previousMaxViewportHeight = maxMobileViewportHeightRef.current || currentViewportHeight;
      const viewportKeyboardOffset = Math.max(0, window.innerHeight - visibleViewportBottom);
      const baselineKeyboardOffset = Math.max(0, previousMaxViewportHeight - visibleViewportBottom);
      const keyboardReduction = Math.max(viewportKeyboardOffset, baselineKeyboardOffset);
      const hasEditableFocus = isEditableElement(document.activeElement);
      const isKeyboardOpen =
        isMobileViewport &&
        keyboardReduction > keyboardThreshold &&
        (hasEditableFocus || keyboardOpenRef.current);

      if (!isMobileViewport) {
        maxMobileViewportHeightRef.current = 0;
      } else if (!isKeyboardOpen) {
        maxMobileViewportHeightRef.current = Math.max(previousMaxViewportHeight, currentViewportHeight);
      }

      keyboardOpenRef.current = isKeyboardOpen;
      const nextState = {
        isKeyboardOpen,
        isMobileViewport,
        // Fixed elements need only the gap between the layout and visual viewport.
        // When a browser resizes both viewports, this is correctly zero.
        keyboardOffset: isKeyboardOpen ? viewportKeyboardOffset : 0,
      };

      setState((current) =>
        current.isKeyboardOpen === nextState.isKeyboardOpen &&
        current.isMobileViewport === nextState.isMobileViewport &&
        current.keyboardOffset === nextState.keyboardOffset
          ? current
          : nextState,
      );
    }

    syncState();
    mediaQuery?.addEventListener("change", syncState);
    window.addEventListener("resize", syncState);
    visualViewport?.addEventListener("resize", syncState);
    visualViewport?.addEventListener("scroll", syncState);
    document.addEventListener("focusin", syncState);
    document.addEventListener("focusout", syncState);

    return () => {
      mediaQuery?.removeEventListener("change", syncState);
      window.removeEventListener("resize", syncState);
      visualViewport?.removeEventListener("resize", syncState);
      visualViewport?.removeEventListener("scroll", syncState);
      document.removeEventListener("focusin", syncState);
      document.removeEventListener("focusout", syncState);
    };
  }, [keyboardThreshold]);

  return state;
}

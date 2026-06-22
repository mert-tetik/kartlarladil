"use client";

import { useLayoutEffect, useState } from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 1023px)";
const DEFAULT_KEYBOARD_THRESHOLD = 160;

export type MobileKeyboardDockState = {
  isKeyboardOpen: boolean;
  isMobileViewport: boolean;
  keyboardOffset: number;
};

export function useMobileKeyboardDock(
  keyboardThreshold = DEFAULT_KEYBOARD_THRESHOLD,
): MobileKeyboardDockState {
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
      const keyboardOffset = Math.max(0, window.innerHeight - (viewportHeight + viewportOffsetTop));
      const isKeyboardOpen = isMobileViewport && window.innerHeight - viewportHeight > keyboardThreshold;

      setState({
        isKeyboardOpen,
        isMobileViewport,
        keyboardOffset: isKeyboardOpen ? keyboardOffset : 0,
      });
    }

    syncState();
    mediaQuery?.addEventListener("change", syncState);
    window.addEventListener("resize", syncState);
    visualViewport?.addEventListener("resize", syncState);
    visualViewport?.addEventListener("scroll", syncState);

    return () => {
      mediaQuery?.removeEventListener("change", syncState);
      window.removeEventListener("resize", syncState);
      visualViewport?.removeEventListener("resize", syncState);
      visualViewport?.removeEventListener("scroll", syncState);
    };
  }, [keyboardThreshold]);

  return state;
}

"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getTwaModeSnapshot,
  initTwaModeStore,
  subscribeTwaMode,
} from "./twa-mode";

/**
 * React hook that returns true when the page is running inside the
 * FoxiesDeck TWA/APK.
 *
 * The value is `false` during server-side rendering and hydration. After
 * hydration the hook initializes the TWA detector and updates if the app is
 * running inside the Play Store TWA.
 */
export function useTwaMode(): boolean {
  const isTwa = useSyncExternalStore(
    subscribeTwaMode,
    getTwaModeSnapshot,
    () => false,
  );

  useEffect(() => {
    initTwaModeStore();
  }, []);

  return isTwa;
}

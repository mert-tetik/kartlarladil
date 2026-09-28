export const VISUAL_TEST_MISSIONS_PATH = "/visual-test-missions";

export function isMissionVisualTestRoute(pathname?: string | null) {
  if (typeof window !== "undefined") {
    return (pathname ?? window.location.pathname) === VISUAL_TEST_MISSIONS_PATH;
  }

  return pathname === VISUAL_TEST_MISSIONS_PATH;
}

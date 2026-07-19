let activeNavigationIntent = 0;

/**
 * Deferred work may only navigate while its intent is current, which makes
 * the most recent user navigation request win over earlier async work.
 */
export function beginNavigationIntent(): number {
  activeNavigationIntent += 1;
  return activeNavigationIntent;
}

export function isActiveNavigationIntent(intent: number): boolean {
  return intent === activeNavigationIntent;
}

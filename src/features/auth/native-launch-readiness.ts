export interface NativeLaunchReadinessInput {
  isSessionReady: boolean;
  userId: string | null;
  inventoryHydrated: boolean;
  ownerUserId: string | null;
}

/**
 * Release native launch as soon as identity-safe local state is available.
 * Cloud inventory refreshes reconcile the snapshot after the UI is visible.
 */
export function isNativeLaunchDataReady(input: NativeLaunchReadinessInput) {
  if (!input.isSessionReady || !input.inventoryHydrated) return false;
  if (!input.userId || !input.ownerUserId) return true;
  return input.ownerUserId === input.userId;
}

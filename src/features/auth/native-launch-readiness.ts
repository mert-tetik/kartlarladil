export interface NativeLaunchReadinessInput {
  isSessionReady: boolean;
  userId: string | null;
  inventoryHydrated: boolean;
  cloudEnabled: boolean;
  cloudLoading: boolean;
  cloudLoadComplete: boolean;
  ownerUserId: string | null;
}

/**
 * Restore local inventory before selecting the day's deck cards. Signed-in
 * launches additionally wait for that user's cloud inventory attempt.
 */
export function isNativeLaunchDataReady(input: NativeLaunchReadinessInput) {
  if (!input.isSessionReady || !input.inventoryHydrated) return false;
  if (!input.userId) return true;

  return input.cloudEnabled &&
    !input.cloudLoading &&
    input.cloudLoadComplete &&
    input.ownerUserId === input.userId;
}

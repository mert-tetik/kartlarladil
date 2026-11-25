export function isInventorySnapshotSafeForSession(input: {
  sessionReady: boolean;
  userId: string | null;
  ownerUserId: string | null;
  hasInventoryCards: boolean;
}): boolean {
  if (!input.sessionReady) return false;
  if (!input.userId) return input.ownerUserId === null;

  return input.ownerUserId === input.userId || (input.ownerUserId === null && input.hasInventoryCards);
}

export function shouldClearInventoryForSession(input: {
  sessionReady: boolean;
  userId: string | null;
  ownerUserId: string | null;
}): boolean {
  return input.sessionReady && input.userId === null && input.ownerUserId !== null;
}

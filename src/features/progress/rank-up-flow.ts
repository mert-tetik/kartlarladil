const LAST_RANK_STORAGE_KEY = "foxiesdeck:last-rank-id";

let quizRankUpDeferred = false;

function getRankStorageKey(userId: string) {
  return `${LAST_RANK_STORAGE_KEY}:${userId}`;
}

export function readLastAcknowledgedRank(userId: string | undefined): string | null {
  if (typeof window === "undefined" || !userId) return null;
  return window.localStorage.getItem(getRankStorageKey(userId));
}

export function acknowledgeRankUp(userId: string | undefined, rankId: string): void {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.setItem(getRankStorageKey(userId), rankId);
}

// Quiz results own rank-up presentation so the result view never races the menu.
export function setQuizRankUpDeferred(deferred: boolean): void {
  quizRankUpDeferred = deferred;
}

export function isQuizRankUpDeferred(): boolean {
  return quizRankUpDeferred;
}

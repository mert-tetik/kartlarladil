import type { PracticeMode } from "@/types/domain";

/** Adjusted Leitner-style review gaps inspired by DuoCards' published schedule. */
export const LEARNED_REVIEW_INTERVALS_MS = [
  90 * 1000,
  30 * 60 * 1000,
  12 * 60 * 60 * 1000,
  2 * 24 * 60 * 60 * 1000,
  14 * 24 * 60 * 60 * 1000,
  60 * 24 * 60 * 60 * 1000,
] as const;

const MAX_FAMILIARITY_LEVEL = LEARNED_REVIEW_INTERVALS_MS.length;

export interface LocalCardStudyRecord {
  lastStudiedAt: string;
  familiarityLevel: number;
  nextReviewAt: string | null;
}

export type LocalCardStudyMap = Record<string, LocalCardStudyRecord>;

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function sanitizeLocalCardStudyMap(value: unknown): LocalCardStudyMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result: LocalCardStudyMap = {};
  for (const [cardId, candidate] of Object.entries(value)) {
    if (!cardId || cardId.length > 512 || !candidate || typeof candidate !== "object") continue;
    const record = candidate as Partial<LocalCardStudyRecord>;
    if (
      !isValidTimestamp(record.lastStudiedAt) ||
      !Number.isSafeInteger(record.familiarityLevel) ||
      record.familiarityLevel! < 0 || record.familiarityLevel! > MAX_FAMILIARITY_LEVEL ||
      (record.nextReviewAt !== null && !isValidTimestamp(record.nextReviewAt))
    ) {
      continue;
    }

    result[cardId] = {
      lastStudiedAt: record.lastStudiedAt,
      familiarityLevel: record.familiarityLevel!,
      nextReviewAt: record.nextReviewAt ?? null,
    };
  }

  return result;
}

export function isLearnedCardDue(record: LocalCardStudyRecord | undefined, now = Date.now()): boolean {
  // Existing learned cards have no local schedule yet, so make them eligible once.
  if (!record || !record.nextReviewAt) return true;
  const dueAt = Date.parse(record.nextReviewAt);
  return !Number.isFinite(dueAt) || dueAt <= now;
}

export function getLearnedCardNextReviewAt(record: LocalCardStudyRecord | undefined) {
  return record?.nextReviewAt ? Date.parse(record.nextReviewAt) : null;
}

export function getLocalCardStudyRecord(
  records: LocalCardStudyMap,
  ...cardIds: Array<string | null | undefined>
): LocalCardStudyRecord | undefined {
  for (const cardId of cardIds) {
    if (cardId && records[cardId]) return records[cardId];
  }
  return undefined;
}

export function createLocalCardStudyRecord(
  previous: LocalCardStudyRecord | undefined,
  input: {
    mode: PracticeMode;
    isCorrect: boolean;
    now: number;
    newlyLearned: boolean;
  },
): LocalCardStudyRecord {
  const lastStudiedAt = new Date(input.now).toISOString();

  if (input.newlyLearned) {
    return {
      lastStudiedAt,
      // The first short review interval starts as soon as a card is learned.
      // A successful review then advances to the 30-minute interval.
      familiarityLevel: 1,
      nextReviewAt: new Date(input.now + LEARNED_REVIEW_INTERVALS_MS[0]).toISOString(),
    };
  }

  if (input.mode !== "learned") {
    return {
      lastStudiedAt,
      familiarityLevel: previous?.familiarityLevel ?? 0,
      nextReviewAt: previous?.nextReviewAt ?? null,
    };
  }

  const familiarityLevel = input.isCorrect
    ? Math.min(MAX_FAMILIARITY_LEVEL, (previous?.familiarityLevel ?? 0) + 1)
    : 0;
  const intervalIndex = Math.max(0, familiarityLevel - 1);
  const interval = LEARNED_REVIEW_INTERVALS_MS[intervalIndex];

  return {
    lastStudiedAt,
    familiarityLevel,
    nextReviewAt: new Date(input.now + interval).toISOString(),
  };
}

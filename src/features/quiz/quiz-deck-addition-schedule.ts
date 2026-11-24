export const QUIZ_DECK_ADDITION_SCHEDULE_STORAGE_KEY = "foxiesdeck:quiz-deck-addition-schedule:v1";

type QuizDeckAdditionScheduleSnapshot = {
  completedQuizCount: number;
  lastQuizSessionId: string | null;
  lastQuizWasScheduled: boolean;
};

const EMPTY_SNAPSHOT: QuizDeckAdditionScheduleSnapshot = {
  completedQuizCount: 0,
  lastQuizSessionId: null,
  lastQuizWasScheduled: false,
};

/** Schedules quiz #2, #5, #8… once per browser-tab session. */
export function isQuizDeckAdditionScheduled(
  sessionId: string,
  storage: Pick<Storage, "getItem" | "setItem">,
): boolean {
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) return false;

  let snapshot = EMPTY_SNAPSHOT;
  try {
    const stored = storage.getItem(QUIZ_DECK_ADDITION_SCHEDULE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<QuizDeckAdditionScheduleSnapshot>;
      if (Number.isSafeInteger(parsed.completedQuizCount) && Number(parsed.completedQuizCount) >= 0) {
        snapshot = {
          completedQuizCount: Number(parsed.completedQuizCount),
          lastQuizSessionId: typeof parsed.lastQuizSessionId === "string" ? parsed.lastQuizSessionId : null,
          lastQuizWasScheduled: parsed.lastQuizWasScheduled === true,
        };
      }
    }
  } catch {
    snapshot = EMPTY_SNAPSHOT;
  }

  if (snapshot.lastQuizSessionId === normalizedSessionId) {
    return snapshot.lastQuizWasScheduled;
  }

  const completedQuizCount = snapshot.completedQuizCount + 1;
  const scheduled = completedQuizCount % 3 === 2;
  const nextSnapshot: QuizDeckAdditionScheduleSnapshot = {
    completedQuizCount,
    lastQuizSessionId: normalizedSessionId,
    lastQuizWasScheduled: scheduled,
  };

  try {
    storage.setItem(QUIZ_DECK_ADDITION_SCHEDULE_STORAGE_KEY, JSON.stringify(nextSnapshot));
  } catch {
    // A storage failure should not block or interrupt the quiz result flow.
  }

  return scheduled;
}

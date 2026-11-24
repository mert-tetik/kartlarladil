import { describe, expect, it } from "vitest";
import {
  isQuizDeckAdditionScheduled,
  QUIZ_DECK_ADDITION_SCHEDULE_STORAGE_KEY,
} from "@/features/quiz/quiz-deck-addition-schedule";

describe("quiz deck-addition cadence", () => {
  it("schedules the 2nd, 5th, and 8th completed quizzes once per session", () => {
    const storage = window.sessionStorage;
    storage.removeItem(QUIZ_DECK_ADDITION_SCHEDULE_STORAGE_KEY);
    const scheduled = Array.from({ length: 8 }, (_, index) =>
      isQuizDeckAdditionScheduled(`quiz-${index + 1}`, storage),
    );

    expect(scheduled).toEqual([false, true, false, false, true, false, false, true]);
    expect(isQuizDeckAdditionScheduled("quiz-8", storage)).toBe(true);
  });

  it("fails safely when session storage is unavailable", () => {
    const storage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };

    expect(isQuizDeckAdditionScheduled("quiz-1", storage)).toBe(false);
    expect(isQuizDeckAdditionScheduled("quiz-2", storage)).toBe(false);
  });
});

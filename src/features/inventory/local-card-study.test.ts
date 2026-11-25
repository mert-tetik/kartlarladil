import { beforeEach, describe, expect, it } from "vitest";
import {
  LEARNED_REVIEW_INTERVALS_MS,
  LOCAL_CARD_STUDY_STORAGE_KEY,
  isLearnedCardDue,
  useLocalCardStudyStore,
} from "@/features/inventory/local-card-study";

describe("local card study schedule", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useLocalCardStudyStore.setState({ cards: {}, learnedReviewIntroSeen: false });
  });

  it("records each card's local last-studied timestamp without waiting for a network action", () => {
    const now = Date.parse("2026-11-25T10:30:00.000Z");

    useLocalCardStudyStore.getState().recordPractice("card-a", "active", true, { now });

    expect(useLocalCardStudyStore.getState().cards["card-a"]).toMatchObject({
      lastStudiedAt: new Date(now).toISOString(),
      familiarityLevel: 0,
      nextReviewAt: null,
    });
    expect(window.localStorage.getItem(LOCAL_CARD_STUDY_STORAGE_KEY)).toContain("card-a");
  });

  it("advances correct learned reviews through spaced intervals and resets missed cards", () => {
    const start = Date.parse("2026-11-25T10:30:00.000Z");
    const store = useLocalCardStudyStore.getState();

    store.recordPractice("card-a", "learned", true, { now: start });
    expect(useLocalCardStudyStore.getState().cards["card-a"]).toMatchObject({
      familiarityLevel: 1,
      nextReviewAt: new Date(start + LEARNED_REVIEW_INTERVALS_MS[0]).toISOString(),
    });

    store.recordPractice("card-a", "learned", true, { now: start + LEARNED_REVIEW_INTERVALS_MS[0] });
    expect(useLocalCardStudyStore.getState().cards["card-a"]).toMatchObject({
      familiarityLevel: 2,
      nextReviewAt: new Date(start + LEARNED_REVIEW_INTERVALS_MS[0] + LEARNED_REVIEW_INTERVALS_MS[1]).toISOString(),
    });

    store.recordPractice("card-a", "learned", false, { now: start + 2_000_000 });
    const missed = useLocalCardStudyStore.getState().cards["card-a"];
    expect(missed).toMatchObject({
      familiarityLevel: 0,
      nextReviewAt: new Date(start + 2_000_000 + LEARNED_REVIEW_INTERVALS_MS[0]).toISOString(),
    });
  });

  it("moves a newly learned card from its short first review to the next interval", () => {
    const learnedAt = Date.parse("2026-11-25T10:30:00.000Z");
    const store = useLocalCardStudyStore.getState();

    store.recordPractice("card-new", "active", true, { now: learnedAt, newlyLearned: true });
    expect(useLocalCardStudyStore.getState().cards["card-new"]).toMatchObject({
      familiarityLevel: 1,
      nextReviewAt: new Date(learnedAt + LEARNED_REVIEW_INTERVALS_MS[0]).toISOString(),
    });

    store.recordPractice("card-new", "learned", true, {
      now: learnedAt + LEARNED_REVIEW_INTERVALS_MS[0],
    });
    expect(useLocalCardStudyStore.getState().cards["card-new"]).toMatchObject({
      familiarityLevel: 2,
      nextReviewAt: new Date(
        learnedAt + LEARNED_REVIEW_INTERVALS_MS[0] + LEARNED_REVIEW_INTERVALS_MS[1],
      ).toISOString(),
    });
  });

  it("treats legacy learned cards as due and persists the tutorial marker locally", () => {
    expect(isLearnedCardDue(undefined, 10_000)).toBe(true);
    useLocalCardStudyStore.getState().markLearnedReviewIntroSeen();

    expect(useLocalCardStudyStore.getState().learnedReviewIntroSeen).toBe(true);
    expect(window.localStorage.getItem(LOCAL_CARD_STUDY_STORAGE_KEY)).toContain("learnedReviewIntroSeen");
  });
});

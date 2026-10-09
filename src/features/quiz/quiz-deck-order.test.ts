import {
  getUniqueCardsForRepetition,
  moveLearningQuestionsToEnd,
} from "./quiz-deck-order";

describe("quiz deck learning question order", () => {
  it("moves card-learning questions to the end without changing order within each group", () => {
    const items = [
      { id: "learning-1", willLearn: true },
      { id: "regular-1", willLearn: false },
      { id: "learning-2", willLearn: true },
      { id: "regular-2", willLearn: false },
    ];

    expect(moveLearningQuestionsToEnd(items).map((item) => item.id)).toEqual([
      "regular-1",
      "regular-2",
      "learning-1",
      "learning-2",
    ]);
  });

  it("also moves the forced first-impression question to the end", () => {
    const items = [
      { id: "first-impression", willLearn: true, forceLearned: true },
      { id: "regular-1", willLearn: false },
      { id: "learning-1", willLearn: true },
    ];

    expect(moveLearningQuestionsToEnd(items).map((item) => item.id)).toEqual([
      "regular-1",
      "first-impression",
      "learning-1",
    ]);
  });

  it("keeps each incorrectly answered card only once for repetition", () => {
    const cards = [
      { id: "card-1" },
      { id: "card-2" },
      { id: "card-1" },
    ];

    expect(getUniqueCardsForRepetition(cards).map((card) => card.id)).toEqual([
      "card-1",
      "card-2",
    ]);
  });
});

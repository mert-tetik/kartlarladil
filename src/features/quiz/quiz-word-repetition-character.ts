const WORD_REPETITION_CHARACTER_IMAGES = [
  "/quiz/quiz-word-repetition-teacher.png?v=20261008-2",
  "/quiz/quiz-word-repetition-teacher-1.png?v=20261008-1",
] as const;

export function getRandomWordRepetitionCharacterImage() {
  return WORD_REPETITION_CHARACTER_IMAGES[
    Math.floor(Math.random() * WORD_REPETITION_CHARACTER_IMAGES.length)
  ]!;
}

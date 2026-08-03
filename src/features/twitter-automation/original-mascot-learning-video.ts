export type OriginalMascotLearningVideoMode = "tier-progression-video" | "vocabulary-quiz-video" | "sentence-check-video";

type BaseScene = {
  subtitle: string;
  audioDataUrl?: string;
  durationSeconds?: number;
};

export type ProgressionVideoScene = BaseScene & {
  kind: "progression";
  terms: { tier: "A1" | "B1" | "C1"; term: string }[];
  activeTier: "A1" | "B1" | "C1" | null;
};

export type QuizVideoScene = BaseScene & {
  kind: "quiz";
  phase: "question" | "countdown" | "reveal" | "explanation";
  term: string;
  tier: "A1" | "A2" | "B1" | "B2" | "C1";
  options: string[];
  correctIndex: number;
};

export type SentenceVideoScene = BaseScene & {
  kind: "sentence";
  phase: "question" | "countdown" | "reveal" | "explanation";
  sentence: string;
  isCorrect: boolean;
  correction: string | null;
};

export type OriginalMascotLearningVideoScene = ProgressionVideoScene | QuizVideoScene | SentenceVideoScene;

export type OriginalMascotLearningVideoPayload = {
  mode: OriginalMascotLearningVideoMode;
  caption: string;
  scenes: OriginalMascotLearningVideoScene[];
};

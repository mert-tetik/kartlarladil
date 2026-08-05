import type { LanguageCode } from "@/types/domain";

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
  mascot: "original" | "mascot4" | "mascot18";
};

export type QuizVideoScene = BaseScene & {
  kind: "quiz";
  phase: "question" | "countdown" | "reveal" | "explanation";
  term: string;
  tier: "A1" | "A2" | "B1" | "B2" | "C1";
  options: string[];
  correctIndex: number;
  language: LanguageCode;
};

export type SentenceVideoScene = BaseScene & {
  kind: "sentence";
  phase: "question" | "countdown" | "reveal" | "explanation";
  sentence: string;
  isCorrect: boolean;
  correction: string | null;
};

export type OutroVideoScene = BaseScene & {
  kind: "outro";
  lines: string[];
};

export type OriginalMascotLearningVideoScene = ProgressionVideoScene | QuizVideoScene | SentenceVideoScene | OutroVideoScene;

export type OriginalMascotLearningVideoPayload = {
  mode: OriginalMascotLearningVideoMode;
  caption: string;
  scenes: OriginalMascotLearningVideoScene[];
};

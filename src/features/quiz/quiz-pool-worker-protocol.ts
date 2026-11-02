import type { QuizPoolInput } from "@/features/quiz/quiz-pool-engine";
import type { QuizPoolProgressUpdate } from "@/features/quiz/quiz-pool-types";

export type QuizPoolWorkerRequest = {
  id: number;
  input: Omit<QuizPoolInput, "key">;
};

export type QuizPoolWorkerResponse =
  | { id: number; update: QuizPoolProgressUpdate }
  | { id: number; complete: true }
  | { id: number; error: string };

import type { QuizPoolInput } from "@/features/quiz/quiz-pool-engine";
import type { PreparedQuizPool } from "@/features/quiz/quiz-pool-types";

export type QuizPoolWorkerRequest = {
  id: number;
  input: Omit<QuizPoolInput, "key">;
};

export type QuizPoolWorkerResponse =
  | { id: number; pool: PreparedQuizPool }
  | { id: number; error: string };

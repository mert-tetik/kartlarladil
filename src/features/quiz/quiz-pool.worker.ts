/// <reference lib="webworker" />

import { buildQuizPool } from "@/features/quiz/quiz-pool-engine";
import type { QuizPoolWorkerRequest, QuizPoolWorkerResponse } from "@/features/quiz/quiz-pool-worker-protocol";

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = async (event: MessageEvent<QuizPoolWorkerRequest>) => {
  const request = event.data;
  if (!request || !Number.isSafeInteger(request.id) || !request.input) return;

  try {
    const pool = await buildQuizPool(
      { ...request.input, key: "worker-result" },
    );
    const response: QuizPoolWorkerResponse = { id: request.id, pool };
    workerScope.postMessage(response);
  } catch (error) {
    const response: QuizPoolWorkerResponse = {
      id: request.id,
      error: error instanceof Error ? error.message : "Quiz preparation failed",
    };
    workerScope.postMessage(response);
  }
};

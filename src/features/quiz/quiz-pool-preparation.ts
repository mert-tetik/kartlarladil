import type { InventoryCard, LanguageCode, LocaleCode, PracticeMode, VocabularyCard } from "@/types/domain";
import type { NormalQuestionType, QuizPoolInput } from "@/features/quiz/quiz-pool-engine";
import type { PreparedQuizPool } from "@/features/quiz/quiz-pool-types";
import type { QuizPoolWorkerRequest, QuizPoolWorkerResponse } from "@/features/quiz/quiz-pool-worker-protocol";

export interface QuizPoolRequest {
  ownerScope: string;
  cards: InventoryCard[];
  customCards: VocabularyCard[];
  language: LanguageCode;
  mode: PracticeMode;
  locale: LocaleCode;
  normalQuestionType: NormalQuestionType;
  bonusAfterEachNormalQuestion: boolean;
}

type ActivePreparation = {
  key: string;
  cancel: () => void;
  promise: Promise<PreparedQuizPool>;
};

const MAX_CACHED_POOLS = 2;
const poolCache = new Map<string, PreparedQuizPool>();
let activePreparation: ActivePreparation | null = null;
let activeOwnerScope: string | null = null;
let nextRequestId = 1;

function stableCardState(cards: InventoryCard[]) {
  return cards
    .map(({ cardId, status, correctCount }) => [cardId, status, correctCount] as const)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
}

function customCardState(cards: VocabularyCard[]) {
  return cards
    .map((card) => JSON.stringify(card))
    .sort()
    .join(",");
}

export function getQuizPoolKey(request: QuizPoolRequest) {
  return JSON.stringify([
    request.ownerScope,
    request.language,
    request.mode,
    request.locale,
    request.normalQuestionType ?? "default",
    request.bonusAfterEachNormalQuestion ? "bonus-each" : "bonus-default",
    stableCardState(request.cards),
    customCardState(request.customCards),
  ]);
}

function makeSeed(key: string) {
  let first = 2166136261;
  let second = 0x9e3779b9;
  for (let index = 0; index < key.length; index += 1) {
    const code = key.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ (code + index), 2246822519);
  }
  return `${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}

function touchCachedPool(key: string) {
  const pool = poolCache.get(key);
  if (!pool) return undefined;
  poolCache.delete(key);
  poolCache.set(key, pool);
  return pool;
}

function storePool(key: string, pool: PreparedQuizPool) {
  poolCache.delete(key);
  poolCache.set(key, { ...pool, key });
  while (poolCache.size > MAX_CACHED_POOLS) {
    const oldestKey = poolCache.keys().next().value;
    if (oldestKey === undefined) break;
    poolCache.delete(oldestKey);
  }
  return poolCache.get(key)!;
}

function cancelActivePreparation() {
  const current = activePreparation;
  if (!current) return;
  activePreparation = null;
  current.cancel();
}

export function clearQuizPoolCache() {
  cancelActivePreparation();
  poolCache.clear();
  activeOwnerScope = null;
}

function isPreparedPool(value: unknown): value is PreparedQuizPool {
  if (!value || typeof value !== "object") return false;
  const pool = value as Partial<PreparedQuizPool>;
  return Array.isArray(pool.regularItems) && pool.regularItems.length <= 50 &&
    Array.isArray(pool.bonusCards) && Array.isArray(pool.bonusLearnedCards) &&
    Array.isArray(pool.bonusPlans) && pool.bonusPlans.length <= 50;
}

async function buildOnMainThread(input: QuizPoolInput, shouldCancel: () => boolean) {
  const { buildQuizPool } = await import("@/features/quiz/quiz-pool-engine");
  return buildQuizPool(input, shouldCancel);
}

export function getCachedQuizPool(key: string) {
  return touchCachedPool(key);
}

export function prepareQuizPool(request: QuizPoolRequest) {
  const key = getQuizPoolKey(request);
  const cached = touchCachedPool(key);
  if (cached) return Promise.resolve(cached);
  if (activePreparation?.key === key) return activePreparation.promise;

  if (activeOwnerScope !== request.ownerScope) {
    cancelActivePreparation();
    poolCache.clear();
    activeOwnerScope = request.ownerScope;
  } else {
    cancelActivePreparation();
  }

  const input: QuizPoolInput = {
    key,
    seed: makeSeed(key),
    cards: request.cards,
    customCards: request.customCards,
    language: request.language,
    mode: request.mode,
    locale: request.locale,
    normalQuestionType: request.normalQuestionType,
    bonusAfterEachNormalQuestion: request.bonusAfterEachNormalQuestion,
  };

  let worker: Worker | null = null;
  let cancelled = false;
  let rejectPromise!: (error: Error) => void;
  const promise = new Promise<PreparedQuizPool>((resolve, reject) => {
    rejectPromise = reject;
    const requestId = nextRequestId++;
    const finish = (pool: PreparedQuizPool) => {
      if (activePreparation?.key !== key) return;
      activePreparation = null;
      worker?.terminate();
      resolve(storePool(key, pool));
    };
    const fail = (error: Error) => {
      if (activePreparation?.key !== key) return;
      activePreparation = null;
      worker?.terminate();
      reject(error);
    };

    if (typeof Worker === "undefined") {
      void buildOnMainThread(input, () => cancelled).then(finish, (error: unknown) => fail(error instanceof Error ? error : new Error("Quiz preparation failed")));
    } else {
      try {
        worker = new Worker(new URL("./quiz-pool.worker.ts", import.meta.url), {
          name: "foxiesdeck-quiz-pool",
        });
        worker.onmessage = (event: MessageEvent<QuizPoolWorkerResponse>) => {
          const response = event.data;
          if (!response || response.id !== requestId) return;
          if ("error" in response) {
            fail(new Error(response.error || "Quiz preparation failed"));
          } else if (isPreparedPool(response.pool)) {
            finish(response.pool);
          } else {
            fail(new Error("Invalid quiz preparation response"));
          }
        };
        worker.onerror = () => {
          worker?.terminate();
          worker = null;
          void buildOnMainThread(input, () => cancelled).then(finish, (error: unknown) => fail(error instanceof Error ? error : new Error("Quiz preparation failed")));
        };
        const workerInput: QuizPoolWorkerRequest["input"] = {
          seed: input.seed,
          cards: input.cards,
          customCards: input.customCards,
          language: input.language,
          mode: input.mode,
          locale: input.locale,
          normalQuestionType: input.normalQuestionType,
          bonusAfterEachNormalQuestion: input.bonusAfterEachNormalQuestion,
        };
        worker.postMessage({ id: requestId, input: workerInput } satisfies QuizPoolWorkerRequest);
      } catch {
        worker?.terminate();
        worker = null;
        void buildOnMainThread(input, () => cancelled).then(finish, (error: unknown) => fail(error instanceof Error ? error : new Error("Quiz preparation failed")));
      }
    }
  });

  activePreparation = {
    key,
    promise,
    cancel: () => {
      cancelled = true;
      worker?.terminate();
      rejectPromise(new DOMException("Quiz preparation cancelled", "AbortError"));
    },
  };
  return promise;
}

import type { InventoryCard, LanguageCode, LocaleCode, PracticeMode, VocabularyCard } from "@/types/domain";
import type { NormalQuestionType, QuizPoolInput } from "@/features/quiz/quiz-pool-engine";
import type {
  PreparedQuizPool,
  QuizPoolProgressUpdate,
} from "@/features/quiz/quiz-pool-types";
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

type ProgressListener = (pool: PreparedQuizPool) => void;
type ErrorListener = (error: Error) => void;

type ActivePreparation = {
  key: string;
  cancel: () => void;
  promise: Promise<PreparedQuizPool>;
  progress: PreparedQuizPool;
  progressListeners: Set<ProgressListener>;
  errorListeners: Set<ErrorListener>;
};

const MAX_CACHED_POOLS = 2;
const MAX_QUIZ_CARDS = 50;
const MAX_BONUS_CARDS = 50_000;
const MAX_PROGRESS_BATCH = 2;
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
  poolCache.set(key, { ...pool, key, complete: true });
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

function createEmptyPool(key: string): PreparedQuizPool {
  return {
    key,
    regularItems: [],
    bonusCards: [],
    bonusLearnedCards: [],
    bonusPlans: [],
    totalCandidateCount: 0,
    metadataReady: false,
    complete: false,
  };
}

function isProgressUpdate(value: unknown): value is QuizPoolProgressUpdate {
  if (!value || typeof value !== "object") return false;
  const update = value as Partial<QuizPoolProgressUpdate>;
  if (
    !Number.isSafeInteger(update.totalCandidateCount) ||
    update.totalCandidateCount! < 0 || update.totalCandidateCount! > MAX_QUIZ_CARDS ||
    !Array.isArray(update.regularItems) || update.regularItems.length > MAX_PROGRESS_BATCH ||
    !Array.isArray(update.bonusPlans) || update.bonusPlans.length !== update.regularItems.length
  ) {
    return false;
  }

  if (update.metadata !== undefined) {
    return Boolean(
      update.metadata &&
      Array.isArray(update.metadata.bonusCards) && update.metadata.bonusCards.length <= MAX_BONUS_CARDS &&
      Array.isArray(update.metadata.bonusLearnedCards) && update.metadata.bonusLearnedCards.length <= MAX_BONUS_CARDS,
    );
  }

  return true;
}

function notifyProgress(active: ActivePreparation) {
  for (const listener of active.progressListeners) {
    try {
      listener(active.progress);
    } catch {
      // A detached UI subscriber must not break preparation for other callers.
    }
  }
}

function notifyError(active: ActivePreparation, error: Error) {
  for (const listener of active.errorListeners) {
    try {
      listener(error);
    } catch {
      // A detached UI subscriber must not break preparation cleanup.
    }
  }
}

function appendProgress(active: ActivePreparation, update: QuizPoolProgressUpdate) {
  if (activePreparation !== active || !isProgressUpdate(update)) return false;

  const current = active.progress;
  if (
    update.totalCandidateCount !== current.totalCandidateCount &&
    current.metadataReady
  ) {
    return false;
  }
  if (!current.metadataReady && !update.metadata) return false;
  if (current.regularItems.length + update.regularItems.length > MAX_QUIZ_CARDS) return false;

  const expectedNextIndex = current.bonusPlans.length;
  if (update.bonusPlans.some((plan, index) => plan.index !== expectedNextIndex + index)) return false;

  active.progress = {
    ...current,
    regularItems: [...current.regularItems, ...update.regularItems],
    bonusPlans: [...current.bonusPlans, ...update.bonusPlans],
    totalCandidateCount: update.totalCandidateCount,
    ...(update.metadata ? {
      bonusCards: update.metadata.bonusCards,
      bonusLearnedCards: update.metadata.bonusLearnedCards,
      metadataReady: true,
    } : {}),
  };
  notifyProgress(active);
  return true;
}

function isCompletePool(pool: PreparedQuizPool) {
  return pool.complete && pool.metadataReady &&
    pool.regularItems.length <= MAX_QUIZ_CARDS &&
    pool.bonusPlans.length === pool.regularItems.length &&
    pool.bonusCards.length <= MAX_BONUS_CARDS &&
    pool.bonusLearnedCards.length <= pool.bonusCards.length;
}

async function buildOnMainThread(
  input: QuizPoolInput,
  shouldCancel: () => boolean,
  onProgress: (update: QuizPoolProgressUpdate) => void,
) {
  const { buildQuizPool } = await import("@/features/quiz/quiz-pool-engine");
  return buildQuizPool(input, shouldCancel, onProgress);
}

export function getCachedQuizPool(key: string) {
  return touchCachedPool(key);
}

export function prepareQuizPool(
  request: QuizPoolRequest,
  onProgress?: ProgressListener,
  onError?: ErrorListener,
) {
  const key = getQuizPoolKey(request);
  const cached = touchCachedPool(key);
  if (cached) {
    onProgress?.(cached);
    return Promise.resolve(cached);
  }
  if (activePreparation?.key === key) {
    if (onProgress) {
      activePreparation.progressListeners.add(onProgress);
      onProgress(activePreparation.progress);
    }
    if (onError) activePreparation.errorListeners.add(onError);
    return activePreparation.promise;
  }

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
  let resolvePromise!: (pool: PreparedQuizPool) => void;
  let rejectPromise!: (error: Error) => void;
  const promise = new Promise<PreparedQuizPool>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  const active: ActivePreparation = {
    key,
    promise,
    progress: createEmptyPool(key),
    progressListeners: new Set(onProgress ? [onProgress] : []),
    errorListeners: new Set(onError ? [onError] : []),
    cancel: () => {
      cancelled = true;
      worker?.terminate();
      const error = new DOMException("Quiz preparation cancelled", "AbortError");
      notifyError(active, error);
      rejectPromise(error);
    },
  };
  activePreparation = active;
  if (onProgress) onProgress(active.progress);

  const requestId = nextRequestId++;
  const fail = (error: Error) => {
    if (activePreparation !== active) return;
    activePreparation = null;
    worker?.terminate();
    notifyError(active, error);
    rejectPromise(error);
  };
  const emitUpdate = (update: QuizPoolProgressUpdate) => {
    if (!appendProgress(active, update)) {
      fail(new Error("Invalid quiz preparation progress"));
    }
  };
  const finish = () => {
    if (activePreparation !== active) return;
    const completePool = { ...active.progress, complete: true };
    if (!isCompletePool(completePool)) {
      fail(new Error("Incomplete quiz preparation"));
      return;
    }
    active.progress = completePool;
    notifyProgress(active);
    activePreparation = null;
    worker?.terminate();
    resolvePromise(storePool(key, completePool));
  };
  const fallbackToMainThread = () => {
    worker?.terminate();
    worker = null;
    if (active.progress.regularItems.length > 0) {
      fail(new Error("Quiz preparation worker stopped unexpectedly"));
      return;
    }
    active.progress = createEmptyPool(key);
    notifyProgress(active);
    void buildOnMainThread(input, () => cancelled, emitUpdate).then(finish, (error: unknown) => {
      fail(error instanceof Error ? error : new Error("Quiz preparation failed"));
    });
  };

  if (typeof Worker === "undefined") {
    void buildOnMainThread(input, () => cancelled, emitUpdate).then(finish, (error: unknown) => {
      fail(error instanceof Error ? error : new Error("Quiz preparation failed"));
    });
    return promise;
  }

  try {
    worker = new Worker(new URL("./quiz-pool.worker.ts", import.meta.url), {
      name: "foxiesdeck-quiz-pool",
    });
    worker.onmessage = (event: MessageEvent<QuizPoolWorkerResponse>) => {
      const response = event.data;
      if (!response || response.id !== requestId || activePreparation !== active) return;
      if ("error" in response) {
        fail(new Error(response.error || "Quiz preparation failed"));
      } else if ("update" in response) {
        emitUpdate(response.update);
      } else if (response.complete === true) {
        finish();
      } else {
        fail(new Error("Invalid quiz preparation response"));
      }
    };
    worker.onerror = fallbackToMainThread;
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
    fallbackToMainThread();
  }

  return promise;
}

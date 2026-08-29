"use client";

import { useSyncExternalStore } from "react";
import type { CardPronunciationResult } from "@/features/cards/card-pronunciation";
import type { VocabularyCard } from "@/types/domain";

const STORAGE_KEY = "foxiesdeck:card-pronunciations:v1";
const RETRY_DELAY_MS = 2_000;
const MAX_CONCURRENT_REQUESTS = 2;

type StoredPronunciation = CardPronunciationResult & { updatedAt: number };
type PronunciationQueueItem = {
  sourceKey: string;
  preview: boolean;
};

const entries = new Map<string, StoredPronunciation>();
const listeners = new Set<() => void>();
const queuedSourceKeys: PronunciationQueueItem[] = [];
const queuedSourceKeySet = new Set<string>();
const activeRequests = new Map<string, AbortController>();
const retryTimers = new Map<string, number>();
let hydrated = false;
let revision = 0;

function emit() {
  revision += 1;
  for (const listener of listeners) listener();
}

function persist() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries.entries())));
  } catch {
    // The database cache remains the source of truth when localStorage is unavailable.
  }
}

export function hydrateCardPronunciationCache() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Record<string, StoredPronunciation>;
    for (const [sourceKey, entry] of Object.entries(parsed)) {
      if (
        entry &&
        (entry.status === "pending" || entry.status === "ready" || entry.status === "failed") &&
        (entry.status !== "ready" || typeof entry.pronunciation === "string")
      ) {
        entries.set(sourceKey, entry);
      }
    }
    emit();
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function updateEntry(sourceKey: string, result: CardPronunciationResult) {
  entries.set(sourceKey, { ...result, updatedAt: Date.now() });
  persist();
  emit();
}

function scheduleRetry(item: PronunciationQueueItem) {
  const previousTimer = retryTimers.get(item.sourceKey);
  if (previousTimer !== undefined) window.clearTimeout(previousTimer);

  const timer = window.setTimeout(() => {
    retryTimers.delete(item.sourceKey);
    if (entries.get(item.sourceKey)?.status !== "pending") return;
    enqueueCardPronunciation(item.sourceKey, { preview: item.preview });
  }, RETRY_DELAY_MS);

  retryTimers.set(item.sourceKey, timer);
}

function insertQueueItem(item: PronunciationQueueItem) {
  if (!item.preview) {
    const firstPreviewIndex = queuedSourceKeys.findIndex((queuedItem) => queuedItem.preview);
    if (firstPreviewIndex >= 0) {
      queuedSourceKeys.splice(firstPreviewIndex, 0, item);
      return;
    }
  }

  queuedSourceKeys.push(item);
}

function removeQueuedItem(sourceKey: string) {
  const queueIndex = queuedSourceKeys.findIndex((item) => item.sourceKey === sourceKey);
  if (queueIndex < 0) return false;

  queuedSourceKeys.splice(queueIndex, 1);
  queuedSourceKeySet.delete(sourceKey);
  return true;
}

export function enqueueCardPronunciation(
  sourceKey: string,
  options: { preview?: boolean } = {},
) {
  if (typeof window === "undefined" || !sourceKey) return;
  hydrateCardPronunciationCache();

  const current = entries.get(sourceKey);
  if (current?.status === "ready" || current?.status === "failed" || activeRequests.has(sourceKey)) {
    return;
  }

  const isPreview = options.preview === true;
  const queuedItem = queuedSourceKeys.find((item) => item.sourceKey === sourceKey);
  if (queuedItem) {
    if (!isPreview && queuedItem.preview) {
      queuedItem.preview = false;
      removeQueuedItem(sourceKey);
      queuedSourceKeySet.add(sourceKey);
      insertQueueItem(queuedItem);
      void drainPronunciationQueue();
    }
    return;
  }

  updateEntry(sourceKey, { status: "pending" });
  queuedSourceKeySet.add(sourceKey);
  insertQueueItem({ sourceKey, preview: isPreview });
  void drainPronunciationQueue();
}

export function cancelCardPronunciation(sourceKey: string) {
  if (typeof window === "undefined" || !sourceKey) return;

  const retryTimer = retryTimers.get(sourceKey);
  if (retryTimer !== undefined) {
    window.clearTimeout(retryTimer);
    retryTimers.delete(sourceKey);
  }

  removeQueuedItem(sourceKey);
  activeRequests.get(sourceKey)?.abort();

  if (entries.get(sourceKey)?.status === "pending") {
    entries.delete(sourceKey);
    persist();
    emit();
  }

  void drainPronunciationQueue();
}

async function processPronunciationItem(item: PronunciationQueueItem, controller: AbortController) {
  try {
    const response = await fetch("/api/cards/pronunciation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceKey: item.sourceKey, ...(item.preview ? { preview: true } : {}) }),
      signal: controller.signal,
    });
    const result = (await response.json().catch(() => null)) as CardPronunciationResult | null;

    if (controller.signal.aborted) return;

    if (result?.status === "ready" && typeof result.pronunciation === "string") {
      updateEntry(item.sourceKey, { status: "ready", pronunciation: result.pronunciation });
    } else if (result?.status === "pending") {
      updateEntry(item.sourceKey, { status: "pending" });
      scheduleRetry(item);
    } else {
      updateEntry(item.sourceKey, { status: "failed" });
    }
  } catch {
    if (!controller.signal.aborted) {
      updateEntry(item.sourceKey, { status: "failed" });
    }
  } finally {
    if (activeRequests.get(item.sourceKey) === controller) {
      activeRequests.delete(item.sourceKey);
    }
    drainPronunciationQueue();
  }
}

function drainPronunciationQueue() {
  while (activeRequests.size < MAX_CONCURRENT_REQUESTS && queuedSourceKeys.length > 0) {
    const item = queuedSourceKeys.shift();
    if (!item) continue;
    queuedSourceKeySet.delete(item.sourceKey);

    const controller = new AbortController();
    activeRequests.set(item.sourceKey, controller);
    void processPronunciationItem(item, controller);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return revision;
}

export function useCardPronunciation(card: VocabularyCard) {
  useSyncExternalStore(subscribe, getSnapshot, () => 0);
  const result = entries.get(card.sourceKey);

  return {
    pronunciation:
      result?.status === "ready" && result.pronunciation ? result.pronunciation : card.pronunciation,
    isLoading: result?.status === "pending",
  };
}

export function shouldQueueCardPronunciation(card: VocabularyCard) {
  // Catalog pronunciations are generated in the checked-in batch map. Only
  // custom cards without a stored pronunciation need the runtime queue.
  return card.sourceKey.startsWith("custom:") && !card.pronunciation.trim();
}

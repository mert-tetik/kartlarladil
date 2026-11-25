"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { customCardRegistry } from "@/features/cards/custom-card-registry";
import { localCardRepository } from "@/features/cards/card-repository";
import { LOCALE_CODES } from "@/data/languages";
import { countActiveCardsForLanguage, limitCardIdsByLanguage } from "@/features/inventory/active-card-limits";
import { FIRST_CARD_ADDED_EVENT } from "@/features/push/push-client";
import { STORAGE_KEY } from "@/lib/constants";
import { sendTwaAnalyticsEvent, trackTwaQualityActivation } from "@/lib/twa-analytics";
import { isFirstLearnedTransition } from "@/lib/twa-analytics-events";
import { trackAnalyticsEvent } from "@/lib/analytics-events";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, normalizeLocale } from "@/i18n/config";
import { translate } from "@/i18n/dictionaries";
import type { GrammarGuide, InventoryCard, LanguageCode, LimitErrorCode, PracticeAttempt, PracticeMode, TermKind, Tier, VocabularyCard } from "@/types/domain";
import type { GeneratedCardDraft } from "@/features/cards/custom-card-types";
import {
  addCloudInventoryCardAction,
  addCloudInventoryCardsAction,
  createCustomCardAction,
  listCloudInventoryAction,
  loadCustomCardsAction,
  migrateLocalInventoryToCloudAction,
  recordCloudPracticeAttemptAction,
  removeCloudInventoryCardAction,
  resetCloudInventoryAction,
} from "@/features/inventory/cloud-actions";
import {
  addCardToInventory,
  applyAnswerProgress,
  createInventoryCard,
  createPracticeAttempt,
} from "@/features/quiz/quiz-engine";
import { syncMissionsFromClientState } from "@/features/missions/mission-sync";
import { refreshLeaderboardPositions } from "@/features/leaderboard/leaderboard-refresh";
import { INVENTORY_BACKGROUND_ERROR_EVENT, type InventoryBackgroundErrorDetail } from "@/features/inventory/inventory-events";
import { recordLocalCardPractice, useLocalCardStudyStore } from "@/features/inventory/local-card-study";

interface RecordAnswerResult {
  attempt: PracticeAttempt;
  inventoryCard: InventoryCard;
}

interface AddCardResult {
  ok: boolean;
  firstCardAdded: boolean;
  limitReached?: boolean;
}

interface AddCardsResult extends AddCardResult {
  addedCardIds: string[];
  remainingCardIds: string[];
}

interface InventoryCloudActionResult<T> {
  status: "success" | "error";
  message: string;
  errorCode?: LimitErrorCode;
  data?: T;
}

export type OptimisticCardMutationKind = "remove" | "mark-learned";

export interface OptimisticCardMutation {
  id: number;
  cardId: string;
  kind: OptimisticCardMutationKind;
  previousCard: InventoryCard;
  previousCardIndex: number;
  previousAttempts: Array<{ attempt: PracticeAttempt; index: number }>;
  optimisticLearnedAt?: string;
}

export interface PendingCardMutation extends OptimisticCardMutation {
  state: "pending" | "settled";
}

export class InventoryActionError extends Error {
  constructor(message: string, readonly errorCode?: LimitErrorCode) {
    super(message);
    this.name = "InventoryActionError";
  }
}

interface InventoryState {
  cards: InventoryCard[];
  attempts: PracticeAttempt[];
  ownerUserId: string | null;
  hydrated: boolean;
  cloudEnabled: boolean;
  cloudLoading: boolean;
  cloudLoadComplete: boolean;
  cloudError: string;
  activeCardLimit: number | null;
  pendingCardIds: Set<string>;
  pendingCardMutations: Map<string, PendingCardMutation>;
  optimisticallyRemoveCard: (cardId: string) => OptimisticCardMutation | null;
  optimisticallyMarkCardLearned: (cardId: string) => OptimisticCardMutation | null;
  settleOptimisticCardMutation: (mutation: OptimisticCardMutation) => void;
  rollbackOptimisticCardMutation: (mutation: OptimisticCardMutation) => void;
  setHydrated: (hydrated: boolean) => void;
  setCloudEnabled: (enabled: boolean) => void;
  setOwnerUserId: (userId: string | null) => void;
  setActiveCardLimit: (limit: number | null) => void;
  clearLocalInventory: () => void;
  loadCloudInventory: () => Promise<void>;
  migrateLocalInventoryToCloud: () => Promise<void>;
  addCard: (cardId: string) => Promise<AddCardResult>;
  addCards: (cardIds: string[]) => Promise<AddCardsResult>;
  removeCard: (cardId: string) => Promise<void>;
  hasCard: (cardId: string) => boolean;
  recordAnswer: (input: {
    cardId: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    mode: PracticeMode;
  }) => Promise<RecordAnswerResult | undefined>;
  reset: () => Promise<void>;
  createCustomCard: (input: {
    language: LanguageCode;
    tier: Tier;
    termKind: TermKind;
    draft: GeneratedCardDraft;
    optimisticCard?: VocabularyCard;
    idempotencyKey?: string;
    awaitCompletion?: boolean;
    onBackgroundError?: (error: InventoryActionError) => void;
  }) => Promise<void>;
  registerPendingCustomCard: (card: VocabularyCard) => void;
}

const OFFLINE_PENDING_CARD_PREFIX = "offline-pending:";
const PERSISTED_CARD_TIERS: Tier[] = ["A1", "A2", "B1", "B2", "C1"];

/**
 * Offline-note previews are reconstructible from their durable IndexedDB draft.
 * Never let their temporary IDs become durable inventory references: a reload
 * clears the in-memory custom-card registry, so those references cannot resolve
 * until the offline queue has been rehydrated.
 */
export function sanitizePersistedInventoryCards(value: unknown): InventoryCard[] {
  if (!Array.isArray(value)) return [];

  return value.filter((candidate): candidate is InventoryCard => {
    if (!candidate || typeof candidate !== "object") return false;
    const card = candidate as Partial<InventoryCard>;
    return typeof card.cardId === "string" &&
      card.cardId.length > 0 &&
      card.cardId.length <= 512 &&
      !card.cardId.startsWith(OFFLINE_PENDING_CARD_PREFIX) &&
      (card.status === "active" || card.status === "learned") &&
      Number.isSafeInteger(card.correctCount) &&
      (card.correctCount ?? -1) >= 0 &&
      typeof card.addedAt === "string" &&
      (card.learnedAt === undefined || typeof card.learnedAt === "string");
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isLocalizedStringRecord(value: unknown): boolean {
  return isRecord(value) && LOCALE_CODES.every((locale) => typeof value[locale] === "string");
}

function isLocalizedStringArrayRecord(value: unknown): boolean {
  return isRecord(value) && LOCALE_CODES.every((locale) => isStringArray(value[locale]));
}

function isGrammarGuide(value: unknown): value is GrammarGuide {
  if (!isRecord(value) || typeof value.summary !== "string" || !isStringArray(value.rules) || !isStringArray(value.details)) {
    return false;
  }

  return value.tables === undefined || (
    Array.isArray(value.tables) && value.tables.every((table) =>
      isRecord(table) &&
      typeof table.title === "string" &&
      isStringArray(table.columns) &&
      Array.isArray(table.rows) && table.rows.every(isStringArray),
    )
  );
}

function isPersistedCustomVocabularyCard(value: unknown): value is VocabularyCard {
  if (!isRecord(value)) return false;

  if (
    typeof value.id !== "string" ||
    typeof value.sourceKey !== "string" ||
    typeof value.englishKey !== "string" ||
    typeof value.term !== "string" ||
    typeof value.translation !== "string" ||
    typeof value.pronunciation !== "string" ||
    typeof value.partOfSpeech !== "string" ||
    typeof value.example !== "string" ||
    typeof value.exampleTranslation !== "string" ||
    typeof value.language !== "string" ||
    !LOCALE_CODES.includes(value.language as LanguageCode) ||
    typeof value.tier !== "string" ||
    !PERSISTED_CARD_TIERS.includes(value.tier as Tier) ||
    (value.termKind !== "word" && value.termKind !== "fixed_phrase") ||
    !isLocalizedStringRecord(value.translations) ||
    !isLocalizedStringArrayRecord(value.translationMeaningsByLocale) ||
    !Array.isArray(value.examples) ||
    !isGrammarGuide(value.grammar)
  ) {
    return false;
  }

  const grammarByLocale = value.grammarByLocale;
  if (
    !isRecord(grammarByLocale) ||
    !LOCALE_CODES.every((locale) => isGrammarGuide(grammarByLocale[locale]))
  ) return false;

  if (value.definitionsByLocale !== undefined && !isRecord(value.definitionsByLocale)) return false;
  if (!value.examples.every((example) =>
    isRecord(example) &&
    typeof example.id === "string" &&
    typeof example.context === "string" &&
    typeof example.label === "string" &&
    typeof example.sentence === "string" &&
    typeof example.translation === "string" &&
    isLocalizedStringRecord(example.translations),
  )) return false;

  return true;
}

export function sanitizePersistedCustomCards(value: unknown): VocabularyCard[] {
  return Array.isArray(value) ? value.filter(isPersistedCustomVocabularyCard) : [];
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      cards: [],
      attempts: [],
      ownerUserId: null,
      hydrated: false,
      cloudEnabled: false,
      cloudLoading: false,
      cloudLoadComplete: true,
      cloudError: "",
      activeCardLimit: null,
      pendingCardIds: new Set(),
      pendingCardMutations: new Map(),

      setHydrated(hydrated) {
        set({ hydrated });
      },

      setCloudEnabled(enabled) {
        if (get().cloudEnabled === enabled) {
          return;
        }

        set({
          cloudEnabled: enabled,
          cloudLoading: false,
          cloudLoadComplete: !enabled,
          cloudError: "",
        });
      },

      setOwnerUserId(userId) {
        set({ ownerUserId: userId });
      },

      setActiveCardLimit(limit) {
        set({ activeCardLimit: limit });
      },

      clearLocalInventory() {
        customCardRegistry.clear();
        useLocalCardStudyStore.getState().clearCardStudy();
        set({
          cards: [],
          attempts: [],
          ownerUserId: null,
          pendingCardIds: new Set(),
          pendingCardMutations: new Map(),
        });
      },

      async loadCloudInventory() {
        if (!get().cloudEnabled) {
          return;
        }

        set({ cloudLoading: true, cloudLoadComplete: false, cloudError: "" });

        try {
          const [inventoryResult, customCardsResult] = await Promise.all([
            runInventoryCloudAction("load inventory", listCloudInventoryAction),
            runInventoryCloudAction("load custom cards", loadCustomCardsAction),
          ]);

          const customCardsLoaded = customCardsResult.status === "success" && Boolean(customCardsResult.data);
          if (customCardsLoaded && customCardsResult.data) {
            customCardRegistry.clear();
            for (const card of customCardsResult.data) {
              customCardRegistry.register(card);
            }
          }

          if (inventoryResult.status === "error" || !inventoryResult.data) {
            set({
              ...(customCardsLoaded ? { cards: [...get().cards] } : {}),
              cloudLoading: false,
              cloudLoadComplete: true,
              cloudError: inventoryResult.message,
            });
            return;
          }

          const currentState = get();
          const nextPendingCardMutations = reconcileSettledCardMutations(
            inventoryResult.data.cards,
            currentState.pendingCardMutations,
          );
          set({
            cards: mergeCloudInventoryCards(
              inventoryResult.data.cards,
              currentState.cards,
              currentState.pendingCardIds,
              currentState.pendingCardMutations,
            ),
            attempts: inventoryResult.data.attempts,
            pendingCardMutations: nextPendingCardMutations,
            cloudLoading: false,
            cloudLoadComplete: true,
            cloudError: "",
          });
        } catch (error) {
          set({
            cloudLoading: false,
            cloudLoadComplete: true,
            cloudError: error instanceof Error ? error.message : "Failed to load cloud inventory",
          });
        }
      },

      optimisticallyRemoveCard(cardId) {
        const state = get();
        if (state.pendingCardMutations.has(cardId)) return null;

        const cardIndex = state.cards.findIndex((card) => card.cardId === cardId);
        if (cardIndex < 0) return null;

        const previousCard = state.cards[cardIndex];
        const previousAttempts = state.attempts.flatMap((attempt, index) =>
          attempt.cardId === cardId ? [{ attempt, index }] : [],
        );
        const mutation: OptimisticCardMutation = {
          id: nextOptimisticCardMutationId(),
          cardId,
          kind: "remove",
          previousCard,
          previousCardIndex: cardIndex,
          previousAttempts,
        };
        const pendingCardMutations = new Map(state.pendingCardMutations);
        pendingCardMutations.set(cardId, { ...mutation, state: "pending" });
        set({
          cards: state.cards.filter((card) => card.cardId !== cardId),
          attempts: state.attempts.filter((attempt) => attempt.cardId !== cardId),
          pendingCardMutations,
        });
        return mutation;
      },

      optimisticallyMarkCardLearned(cardId) {
        const state = get();
        if (state.pendingCardMutations.has(cardId)) return null;

        const cardIndex = state.cards.findIndex((card) => card.cardId === cardId);
        if (cardIndex < 0 || state.cards[cardIndex].status === "learned") return null;

        const previousCard = state.cards[cardIndex];
        const optimisticLearnedAt = new Date().toISOString();
        const mutation: OptimisticCardMutation = {
          id: nextOptimisticCardMutationId(),
          cardId,
          kind: "mark-learned",
          previousCard,
          previousCardIndex: cardIndex,
          previousAttempts: [],
          optimisticLearnedAt,
        };
        const pendingCardMutations = new Map(state.pendingCardMutations);
        pendingCardMutations.set(cardId, { ...mutation, state: "pending" });
        set({
          cards: state.cards.map((card, index) =>
            index === cardIndex
              ? { ...card, status: "learned", learnedAt: optimisticLearnedAt }
              : card,
          ),
          pendingCardMutations,
        });
        return mutation;
      },

      settleOptimisticCardMutation(mutation) {
        const state = get();
        const current = state.pendingCardMutations.get(mutation.cardId);
        if (!current || current.id !== mutation.id) return;

        const pendingCardMutations = new Map(state.pendingCardMutations);
        pendingCardMutations.set(mutation.cardId, { ...current, state: "settled" });
        set({ pendingCardMutations });
      },

      rollbackOptimisticCardMutation(mutation) {
        const state = get();
        const current = state.pendingCardMutations.get(mutation.cardId);
        if (!current || current.id !== mutation.id) return;

        let cards = state.cards;
        let attempts = state.attempts;
        if (mutation.kind === "remove") {
          if (!cards.some((card) => card.cardId === mutation.cardId)) {
            const nextCards = [...cards];
            nextCards.splice(
              Math.min(mutation.previousCardIndex, nextCards.length),
              0,
              mutation.previousCard,
            );
            cards = nextCards;
          }

          const existingAttemptIds = new Set(attempts.map((attempt) => attempt.id));
          const nextAttempts = [...attempts];
          mutation.previousAttempts.forEach(({ attempt, index }) => {
            if (existingAttemptIds.has(attempt.id)) return;
            nextAttempts.splice(Math.min(index, nextAttempts.length), 0, attempt);
          });
          attempts = nextAttempts;
        } else {
          const currentCard = cards.find((card) => card.cardId === mutation.cardId);
          if (currentCard?.learnedAt === mutation.optimisticLearnedAt) {
            cards = cards.map((card) =>
              card.cardId === mutation.cardId ? mutation.previousCard : card,
            );
          }
        }

        const pendingCardMutations = new Map(state.pendingCardMutations);
        pendingCardMutations.delete(mutation.cardId);
        set({ cards, attempts, pendingCardMutations });
      },

      async migrateLocalInventoryToCloud() {
        if (!get().cloudEnabled) {
          return;
        }

        set({ cloudLoading: true, cloudLoadComplete: false, cloudError: "" });
        const result = await runInventoryCloudAction(
          "migrate local inventory",
          () => migrateLocalInventoryToCloudAction(get().cards),
        );

        if (result.status === "error" || !result.data) {
          set({ cloudLoading: false, cloudLoadComplete: true, cloudError: result.message });
          return;
        }

        set({
          cards: result.data.cards,
          attempts: result.data.attempts,
          cloudLoading: false,
          cloudLoadComplete: true,
          cloudError: "",
        });

        await syncMissionsFromClientState();
      },

      async addCard(cardId) {
        const currentCards = get().cards;
        const previousCount = currentCards.length;
        if (currentCards.some((card) => card.cardId === cardId)) {
          return { ok: true, firstCardAdded: false };
        }

        const activeCardLimit = get().activeCardLimit;
        const targetCard = activeCardLimit === null ? null : localCardRepository.findById(cardId);

        if (
          activeCardLimit !== null &&
          targetCard &&
          countActiveCardsForLanguage(get().cards, targetCard.language) >= activeCardLimit
        ) {
          return { ok: false, firstCardAdded: false, limitReached: true };
        }

        if (get().cloudEnabled) {
          // Local inventory is authoritative for the user-facing add. The
          // cloud write starts below and can reconcile or roll back later.
          const optimisticCards = [...currentCards, createInventoryCard(cardId)];
          set((state) => ({
            ...state,
            cards: optimisticCards,
            pendingCardIds: new Set(state.pendingCardIds).add(cardId),
          }));
          const addedCard = localCardRepository.findById(cardId);

          if (addedCard) {
            sendTwaAnalyticsEvent("fd_card_added", {
              params: {
                card_id: addedCard.id,
                card_language: addedCard.language,
                card_tier: addedCard.tier,
                term_kind: addedCard.termKind,
              },
            });
          }
          if (optimisticCards.length > 0) {
            sendTwaAnalyticsEvent("fd_first_card_added", { once: true });
            trackTwaQualityActivation("first_card_added");
          }
          const firstCardAdded = previousCount === 0 && optimisticCards.length > 0;
          if (firstCardAdded) {
            dispatchFirstCardAddedEvent();
          }

          scheduleMissionSyncFromClientState();

          void (async () => {
            const result = await runInventoryCloudAction(
              "add card",
              () => enqueueCloudCardAddition(get().ownerUserId, () => addCloudInventoryCardAction(cardId)),
            );
            removePendingCardId(set, cardId);

            if (result.status === "error" || !result.data) {
              const currentState = get();
              set({
                cards: currentState.cards.filter((card) => card.cardId !== cardId),
                cloudError: "",
              });
              dispatchInventoryBackgroundError("add card", result);
              void syncMissionsFromClientState();
              return;
            }

            const currentState = get();
            if (currentState.cards.some((card) => card.cardId === cardId)) {
              const cloudCard = result.data.cards.find((card) => card.cardId === cardId);
              set({
                cards: cloudCard
                  ? currentState.cards.map((card) => card.cardId === cardId ? cloudCard : card)
                  : currentState.cards,
                cloudError: "",
              });
            }
            if (firstCardAdded) {
              trackAnalyticsEvent("first_card_added", {
                card_language: addedCard?.language ?? "",
                card_tier: addedCard?.tier ?? "",
                term_kind: addedCard?.termKind ?? "",
              }, {
                once: true,
                dedupeKey: get().ownerUserId ?? undefined,
              });
            }
            void syncMissionsFromClientState();
          })();

          return { ok: true, firstCardAdded };
        }

        const nextCards = [...currentCards, createInventoryCard(cardId)];
        set({ cards: nextCards });
        const firstCardAdded = previousCount === 0 && nextCards.length > 0;
        const addedCard = localCardRepository.findById(cardId);

        if (addedCard) {
          sendTwaAnalyticsEvent("fd_card_added", {
            params: {
              card_id: addedCard.id,
              card_language: addedCard.language,
              card_tier: addedCard.tier,
              term_kind: addedCard.termKind,
            },
          });
        }
        if (nextCards.length > 0) {
          sendTwaAnalyticsEvent("fd_first_card_added", { once: true });
          trackTwaQualityActivation("first_card_added");
        }
        if (firstCardAdded) {
          trackAnalyticsEvent("first_card_added", {
            card_language: addedCard?.language ?? "",
            card_tier: addedCard?.tier ?? "",
            term_kind: addedCard?.termKind ?? "",
          }, {
            once: true,
            dedupeKey: get().ownerUserId ?? undefined,
          });
          dispatchFirstCardAddedEvent();
        }

        scheduleMissionSyncFromClientState();

        return { ok: true, firstCardAdded };
      },

      async addCards(cardIds) {
        const requestedCardIds = [...new Set(cardIds.filter((cardId) => typeof cardId === "string" && cardId.trim().length > 0))];
        const previousCount = get().cards.length;

        if (requestedCardIds.length === 0) {
          return {
            ok: true,
            firstCardAdded: false,
            addedCardIds: [],
            remainingCardIds: [],
          };
        }

        if (get().cloudEnabled) {
          // Batch adds follow the same local-first contract as single adds.
          const existingIds = new Set(get().cards.map((card) => card.cardId));
          const newCardIds = requestedCardIds.filter((cardId) => !existingIds.has(cardId));
          const activeCardLimit = get().activeCardLimit;
          const { allowedCardIds: optimisticCardIds, remainingCardIds } = limitCardIdsByLanguage(
            newCardIds,
            get().cards,
            activeCardLimit,
          );

          if (optimisticCardIds.length > 0) {
            set((state) => ({
              ...state,
              cards: optimisticCardIds.reduce(
                (cards, cardId) => addCardToInventory(cards, cardId),
                state.cards,
              ),
              pendingCardIds: new Set([...state.pendingCardIds, ...optimisticCardIds]),
              cloudError: "",
            }));
          }

          const firstCardAdded = previousCount === 0 && optimisticCardIds.length > 0;
          for (const cardId of optimisticCardIds) {
            const addedCard = localCardRepository.findById(cardId);
            if (!addedCard) continue;

            sendTwaAnalyticsEvent("fd_card_added", {
              params: {
                card_id: addedCard.id,
                card_language: addedCard.language,
                card_tier: addedCard.tier,
                term_kind: addedCard.termKind,
              },
            });
          }

          if (optimisticCardIds.length > 0) {
            sendTwaAnalyticsEvent("fd_first_card_added", { once: true });
            trackTwaQualityActivation("first_card_added");
          }
          if (firstCardAdded) {
            dispatchFirstCardAddedEvent();
          }

          void syncMissionsFromClientState();

          if (optimisticCardIds.length > 0) {
            void (async () => {
              const result = await runInventoryCloudAction(
                "add cards",
                () => enqueueCloudCardAddition(
                  get().ownerUserId,
                  () => addCloudInventoryCardsAction(requestedCardIds),
                ),
              );

              if (result.status === "error" || !result.data) {
                set((state) => {
                  const optimisticCardIdSet = new Set(optimisticCardIds);
                  const pendingCardIds = new Set(state.pendingCardIds);
                  optimisticCardIds.forEach((cardId) => pendingCardIds.delete(cardId));

                  return {
                    ...state,
                    cards: state.cards.filter((card) => !optimisticCardIdSet.has(card.cardId)),
                    pendingCardIds,
                    cloudError: "",
                  };
                });
                dispatchInventoryBackgroundError("add cards", result);
                void syncMissionsFromClientState();
                return;
              }

              const cloudData = result.data;
              set((state) => {
                const pendingCardIds = new Set(state.pendingCardIds);
                optimisticCardIds.forEach((cardId) => pendingCardIds.delete(cardId));
                const cloudCardsById = new Map(cloudData.cards.map((card) => [card.cardId, card]));
                const optimisticCardIdSet = new Set(optimisticCardIds);

                return {
                  ...state,
                  cards: state.cards.flatMap((card) => {
                    if (!optimisticCardIdSet.has(card.cardId)) return [card];
                    const cloudCard = cloudCardsById.get(card.cardId);
                    return cloudCard ? [cloudCard] : [];
                  }),
                  pendingCardIds,
                  cloudError: "",
                };
              });

              if (firstCardAdded) {
                const firstAddedCard = localCardRepository.findById(optimisticCardIds[0]);
                trackAnalyticsEvent("first_card_added", {
                  card_language: firstAddedCard?.language ?? "",
                  card_tier: firstAddedCard?.tier ?? "",
                  term_kind: firstAddedCard?.termKind ?? "",
                }, {
                  once: true,
                  dedupeKey: get().ownerUserId ?? undefined,
                });
              }

              if (cloudData.remainingCardIds.length > 0) {
                dispatchInventoryBackgroundError("add cards", {
                  status: "error",
                  message: getBackgroundCardLimitMessage(),
                  errorCode: "free_active_card_limit",
                });
              }
              void syncMissionsFromClientState();
            })();
          }

          return {
            ok: true,
            firstCardAdded,
            addedCardIds: optimisticCardIds,
            remainingCardIds,
            limitReached: remainingCardIds.length > 0,
          };
        }

        const existingIds = new Set(get().cards.map((card) => card.cardId));
        const newCardIds = requestedCardIds.filter((cardId) => !existingIds.has(cardId));
        const activeCardLimit = get().activeCardLimit;
        const { allowedCardIds: addedCardIds, remainingCardIds } = limitCardIdsByLanguage(
          newCardIds,
          get().cards,
          activeCardLimit,
        );
        const nextCards = addedCardIds.reduce(
          (cards, cardId) => addCardToInventory(cards, cardId),
          get().cards,
        );

        set({ cards: nextCards });

        for (const cardId of addedCardIds) {
          const addedCard = localCardRepository.findById(cardId);
          if (!addedCard) continue;

          sendTwaAnalyticsEvent("fd_card_added", {
            params: {
              card_id: addedCard.id,
              card_language: addedCard.language,
              card_tier: addedCard.tier,
              term_kind: addedCard.termKind,
            },
          });
        }

        if (addedCardIds.length > 0) {
          sendTwaAnalyticsEvent("fd_first_card_added", { once: true });
          trackTwaQualityActivation("first_card_added");
        }

        const firstCardAdded = previousCount === 0 && nextCards.length > 0;
        if (firstCardAdded) {
          const firstAddedCard = addedCardIds.length > 0
            ? localCardRepository.findById(addedCardIds[0])
            : null;
          trackAnalyticsEvent("first_card_added", {
            card_language: firstAddedCard?.language ?? "",
            card_tier: firstAddedCard?.tier ?? "",
            term_kind: firstAddedCard?.termKind ?? "",
          }, {
            once: true,
            dedupeKey: get().ownerUserId ?? undefined,
          });
          dispatchFirstCardAddedEvent();
        }

        void syncMissionsFromClientState();

        return {
          ok: true,
          firstCardAdded,
          addedCardIds,
          remainingCardIds,
          limitReached: remainingCardIds.length > 0,
        };
      },

      async removeCard(cardId) {
        if (get().cloudEnabled) {
          set({ cloudLoading: true, cloudError: "" });
          addPendingCardId(set, cardId);

          const previousCards = get().cards;
          const previousAttempts = get().attempts;
          set({
            cards: previousCards.filter((card) => card.cardId !== cardId),
            attempts: previousAttempts.filter((attempt) => attempt.cardId !== cardId),
          });

          const result = await runInventoryCloudAction(
            "remove card",
            () => removeCloudInventoryCardAction(cardId),
          );
          removePendingCardId(set, cardId);

          if (result.status === "error" || !result.data) {
            set({
              cards: previousCards,
              attempts: previousAttempts,
              cloudLoading: false,
              cloudError: result.message,
            });
            return;
          }

          set({
            cards: result.data.cards,
            attempts: result.data.attempts,
            cloudLoading: false,
            cloudError: "",
          });
          forgetLocalStudyForCard(cardId);
          await syncMissionsFromClientState();
          return;
        }

        set((state) => ({
          cards: state.cards.filter((card) => card.cardId !== cardId),
          attempts: state.attempts.filter((attempt) => attempt.cardId !== cardId),
        }));
        forgetLocalStudyForCard(cardId);

        void syncMissionsFromClientState();
      },

      hasCard(cardId) {
        return get().cards.some((card) => card.cardId === cardId);
      },

      async recordAnswer(input) {
        const vocabularyCard = localCardRepository.findById(input.cardId)
          ?? customCardRegistry.findBySourceKey(input.cardId);
        const initialOwnedCard = get().cards.find((card) => card.cardId === input.cardId);

        if (vocabularyCard && initialOwnedCard) {
          const locallyUpdatedCard = input.mode === "learned"
            ? initialOwnedCard
            : applyAnswerProgress(initialOwnedCard, vocabularyCard, input.isCorrect);
          recordLocalCardPractice(input.cardId, input.mode, input.isCorrect, {
            newlyLearned: initialOwnedCard.status !== "learned" && locallyUpdatedCard.status === "learned",
          });
        }

        if (get().cloudEnabled && get().pendingCardIds.has(input.cardId)) {
          await waitForCloudCardAddition(get().ownerUserId);
        }

        const ownedCard = get().cards.find((card) => card.cardId === input.cardId);

        if (get().cloudEnabled) {
          const previousCards = get().cards;
          const previousAttempts = get().attempts;
          const hadLearnedCardBefore = previousCards.some((card) => card.status === "learned");

          let optimisticCards = previousCards;
          let optimisticAttempts = previousAttempts;

          if (vocabularyCard && ownedCard && input.mode !== "learned") {
            const updatedCard = applyAnswerProgress(
              ownedCard,
              vocabularyCard,
              input.isCorrect,
              undefined,
            );
            optimisticCards = previousCards.map((card) =>
              card.cardId === input.cardId ? updatedCard : card,
            );
          }

          const optimisticAttempt = createPracticeAttempt(input);
          optimisticAttempts = [optimisticAttempt, ...previousAttempts].slice(0, 100);

          set({
            cards: optimisticCards,
            attempts: optimisticAttempts,
            cloudLoading: true,
            cloudError: "",
          });

          const serverInput = {
            cardId: input.cardId,
            selectedAnswer: input.selectedAnswer,
            correctAnswer: input.correctAnswer,
            isCorrect: input.isCorrect,
            mode: input.mode,
          };
          const result = await runInventoryCloudAction(
            "record practice answer",
            () => recordCloudPracticeAttemptAction(serverInput),
          );

          if (result.status === "error" || !result.data) {
            set({
              cards: previousCards,
              attempts: previousAttempts,
              cloudLoading: false,
              cloudError: result.message,
            });
            if (result.errorCode) {
              throw new InventoryActionError(result.message, result.errorCode);
            }
            return undefined;
          }

          const inventoryCard = result.data.cards.find((card) => card.cardId === input.cardId);
          const attempt = result.data.attempts.find(
            (item) =>
              item.cardId === input.cardId &&
              item.selectedAnswer === input.selectedAnswer &&
              item.correctAnswer === input.correctAnswer,
          );

          set({
            cards: result.data.cards,
            attempts: result.data.attempts,
            cloudLoading: false,
            cloudError: "",
          });

          const didLearnCard = inventoryCard && isFirstLearnedTransition(ownedCard?.status ?? "active", inventoryCard.status);

          if (didLearnCard) {
            sendTwaAnalyticsEvent("fd_card_learned", {
              params: {
                card_id: inventoryCard.cardId,
                card_language: vocabularyCard?.language ?? "",
                card_tier: vocabularyCard?.tier ?? "",
                term_kind: vocabularyCard?.termKind ?? "",
                correct_count: inventoryCard.correctCount,
              },
            });
            if (!hadLearnedCardBefore) {
              sendTwaAnalyticsEvent("fd_first_card_learned", {
                once: true,
                params: {
                  card_language: vocabularyCard?.language ?? "",
                  card_tier: vocabularyCard?.tier ?? "",
                  term_kind: vocabularyCard?.termKind ?? "",
                  correct_count: inventoryCard.correctCount,
                },
              });
              trackAnalyticsEvent("first_card_learned", {
                card_language: vocabularyCard?.language ?? "",
                card_tier: vocabularyCard?.tier ?? "",
                term_kind: vocabularyCard?.termKind ?? "",
                correct_count: inventoryCard.correctCount,
              }, {
                once: true,
                dedupeKey: get().ownerUserId ?? undefined,
              });
            }
          }

          if (didLearnCard) {
            refreshLeaderboardPositions();
          }

          await syncMissionsFromClientState();

          return inventoryCard && attempt ? { inventoryCard, attempt } : undefined;
        }

        if (!vocabularyCard || !ownedCard) {
          return undefined;
        }

        const updatedCard =
          input.mode === "learned"
            ? ownedCard
            : applyAnswerProgress(ownedCard, vocabularyCard, input.isCorrect);
        const attempt = createPracticeAttempt(input);
        const hadLearnedCardBefore = get().cards.some((card) => card.status === "learned");

        set((state) => ({
          cards: state.cards.map((card) => (card.cardId === input.cardId ? updatedCard : card)),
          attempts: [attempt, ...state.attempts].slice(0, 100),
        }));

        if (isFirstLearnedTransition(ownedCard.status, updatedCard.status)) {
          sendTwaAnalyticsEvent("fd_card_learned", {
            params: {
              card_id: updatedCard.cardId,
              card_language: vocabularyCard.language,
              card_tier: vocabularyCard.tier,
              term_kind: vocabularyCard.termKind,
              correct_count: updatedCard.correctCount,
            },
          });
          if (!hadLearnedCardBefore) {
            sendTwaAnalyticsEvent("fd_first_card_learned", {
              once: true,
              params: {
                card_language: vocabularyCard.language,
                card_tier: vocabularyCard.tier,
                term_kind: vocabularyCard.termKind,
                correct_count: updatedCard.correctCount,
              },
            });
            trackAnalyticsEvent("first_card_learned", {
              card_language: vocabularyCard.language,
              card_tier: vocabularyCard.tier,
              term_kind: vocabularyCard.termKind,
              correct_count: updatedCard.correctCount,
            }, {
              once: true,
              dedupeKey: get().ownerUserId ?? undefined,
            });
          }
        }

        void syncMissionsFromClientState();

        return {
          attempt,
          inventoryCard: updatedCard,
        };
      },

      async reset() {
        if (get().cloudEnabled) {
          set({ cloudLoading: true, cloudError: "" });
          const result = await runInventoryCloudAction("reset inventory", resetCloudInventoryAction);

          if (result.status === "error" || !result.data) {
            set({ cloudLoading: false, cloudError: result.message });
            return;
          }

          customCardRegistry.clear();

          set({
            cards: result.data.cards,
            attempts: result.data.attempts,
            cloudLoading: false,
            cloudError: "",
          });
          useLocalCardStudyStore.getState().clearCardStudy();
          await syncMissionsFromClientState();
          return;
        }

        customCardRegistry.clear();

        set({
          cards: [],
          attempts: [],
          ownerUserId: null,
          pendingCardMutations: new Map(),
        });
        useLocalCardStudyStore.getState().clearCardStudy();

        void syncMissionsFromClientState();
      },

      async createCustomCard(input) {
        const optimisticCard = input.optimisticCard;
        const optimisticCardId = optimisticCard?.sourceKey;
        const wasEmptyBeforeCreate = get().cards.length === 0;
        const request = {
          language: input.language,
          tier: input.tier,
          termKind: input.termKind,
          draft: input.draft,
        };

        if (optimisticCard && optimisticCardId) {
          // The preview card is usable immediately; persistence is background
          // work and reports failures through the global inventory event.
          customCardRegistry.register(optimisticCard);
          set({
            cards: addCardToInventory(get().cards, optimisticCardId),
            cloudError: "",
          });
          addPendingCardId(set, optimisticCardId);
        }

        const creation = (async () => {
          let result: Awaited<ReturnType<typeof createCustomCardAction>>;
          try {
            result = input.idempotencyKey
              ? await createCustomCardThroughOfflineRoute(input)
              : await createCustomCardAction(request);
          } catch {
            rollbackBackgroundCustomCard(set, optimisticCardId);
            const backgroundError = new InventoryActionError(getBackgroundCardErrorMessage());
            dispatchInventoryBackgroundError("create custom card", {
              status: "error",
              message: backgroundError.message,
            });
            safelyNotifyBackgroundError(input.onBackgroundError, backgroundError);
            return;
          }

          if (result.status === "error" || !result.data) {
            const message = getCloudActionErrorMessage(result);
            rollbackBackgroundCustomCard(set, optimisticCardId);
            const backgroundError = new InventoryActionError(message, result.errorCode);
            dispatchInventoryBackgroundError("create custom card", {
              status: "error",
              message,
              errorCode: result.errorCode,
            });
            safelyNotifyBackgroundError(input.onBackgroundError, backgroundError);
            return;
          }

          const created = result.data;
          if (optimisticCardId) {
            customCardRegistry.unregister(optimisticCardId);
            removePendingCardId(set, optimisticCardId);
          }
          customCardRegistry.register(created.vocabularyCard);

          set({
            cards: [
              created.card,
              ...get().cards.filter(
                (card) => card.cardId !== created.card.cardId && card.cardId !== optimisticCardId,
              ),
            ],
            cloudError: "",
          });

          sendTwaAnalyticsEvent("fd_custom_card_added", {
            params: {
              card_id: created.card.cardId,
              card_language: created.vocabularyCard.language,
              card_tier: created.vocabularyCard.tier,
              term_kind: created.vocabularyCard.termKind,
            },
          });
          if (wasEmptyBeforeCreate) {
            trackAnalyticsEvent("first_card_added", {
              card_language: created.vocabularyCard.language,
              card_tier: created.vocabularyCard.tier,
              term_kind: created.vocabularyCard.termKind,
            }, {
              once: true,
              dedupeKey: get().ownerUserId ?? undefined,
            });
          }

          void syncMissionsFromClientState();
        })();

        if (input.awaitCompletion) {
          await creation;
        } else {
          void creation;
        }
      },

      registerPendingCustomCard(card) {
        customCardRegistry.register(card);
        set((state) => ({
          ...state,
          cards: addCardToInventory(state.cards, card.sourceKey),
          cloudError: "",
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        cards: sanitizePersistedInventoryCards(state.cards),
        attempts: state.attempts,
        ownerUserId: state.ownerUserId,
        customCards: (() => {
          const inventoryIds = new Set(state.cards.map((card) => card.cardId));
          return customCardRegistry.list().filter((card) =>
            inventoryIds.has(card.sourceKey) || inventoryIds.has(card.id),
          );
        })(),
      }),
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== "object") return currentState;
        const persisted = persistedState as Partial<InventoryState> & { customCards?: unknown };
        const cards = Array.isArray(persisted.cards)
          ? sanitizePersistedInventoryCards(persisted.cards)
          : currentState.cards;
        const inventoryIds = new Set(cards.map((card) => card.cardId));
        customCardRegistry.clear();
        for (const card of sanitizePersistedCustomCards(persisted.customCards)) {
          if (inventoryIds.has(card.id) || inventoryIds.has(card.sourceKey)) {
            customCardRegistry.register(card);
          }
        }

        return {
          ...currentState,
          cards,
          attempts: Array.isArray(persisted.attempts) ? persisted.attempts : currentState.attempts,
          ownerUserId: typeof persisted.ownerUserId === "string" ? persisted.ownerUserId : null,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

function addPendingCardId(set: (fn: (state: InventoryState) => InventoryState) => void, cardId: string) {
  set((state) => ({
    ...state,
    pendingCardIds: new Set(state.pendingCardIds).add(cardId),
  }));
}

function scheduleMissionSyncFromClientState() {
  if (typeof window === "undefined") {
    void syncMissionsFromClientState();
    return;
  }

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  };
  const sync = () => void syncMissionsFromClientState();

  if (idleWindow.requestIdleCallback) {
    idleWindow.requestIdleCallback(sync, { timeout: 750 });
  } else {
    window.setTimeout(sync, 0);
  }
}

function forgetLocalStudyForCard(cardId: string) {
  const card = localCardRepository.findById(cardId) ?? customCardRegistry.findBySourceKey(cardId);
  useLocalCardStudyStore.getState().forgetCards(
    [cardId, card?.id, card?.sourceKey].filter((value): value is string => Boolean(value)),
  );
}

function dispatchInventoryBackgroundError(
  operation: string,
  result: Pick<InventoryCloudActionResult<unknown>, "message" | "errorCode"> & { status?: "success" | "error" },
) {
  if (typeof window === "undefined") return;

  const message = result.message.trim() || getBackgroundCardErrorMessage();
  window.dispatchEvent(new CustomEvent<InventoryBackgroundErrorDetail>(INVENTORY_BACKGROUND_ERROR_EVENT, {
    detail: {
      operation,
      message,
      errorCode: result.errorCode,
    },
  }));
}

function rollbackBackgroundCustomCard(
  set: (fn: (state: InventoryState) => InventoryState) => void,
  optimisticCardId: string | undefined,
) {
  if (!optimisticCardId) return;

  customCardRegistry.unregister(optimisticCardId);
  removePendingCardId(set, optimisticCardId);
  set((state) => ({
    ...state,
    cards: state.cards.filter((card) => card.cardId !== optimisticCardId),
    cloudError: "",
  }));
}

function getBackgroundCardErrorMessage() {
  return translate(getClientLocale(), "inventory.error.operationFailed");
}

function getBackgroundCardLimitMessage() {
  return translate(getClientLocale(), "limit.activeCardLimitDescription");
}

function safelyNotifyBackgroundError(
  callback: ((error: InventoryActionError) => void) | undefined,
  error: InventoryActionError,
) {
  if (!callback) return;

  try {
    callback(error);
  } catch {
    // A recovery callback must never break the background sync loop.
  }
}

function getClientLocale() {
  let locale = DEFAULT_LOCALE;
  try {
    locale = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    // Keep the default locale when browser storage is unavailable.
  }
  return locale;
}

async function runInventoryCloudAction<T>(
  operation: string,
  action: () => Promise<InventoryCloudActionResult<T>>,
): Promise<InventoryCloudActionResult<T>> {
  try {
    return await action();
  } catch (error) {
    try {
      console.error("[FoxiesDeck inventory] Cloud action rejected unexpectedly.", {
        operation,
        error,
      });
    } catch {
      // Logging must not prevent optimistic state from being rolled back.
    }

    let locale = DEFAULT_LOCALE;
    try {
      locale = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    } catch {
      // The default locale keeps recovery available when browser storage is blocked.
    }

    return {
      status: "error",
      message: translate(locale, "inventory.error.operationFailed"),
    };
  }
}

function removePendingCardId(set: (fn: (state: InventoryState) => InventoryState) => void, cardId: string) {
  set((state) => {
    const next = new Set(state.pendingCardIds);
    next.delete(cardId);
    return { ...state, pendingCardIds: next };
  });
}

const cloudCardAddQueues = new Map<string, Promise<void>>();

function enqueueCloudCardAddition<T>(ownerUserId: string | null, operation: () => Promise<T>): Promise<T> {
  const queueKey = ownerUserId ?? "active-session";
  const previous = cloudCardAddQueues.get(queueKey) ?? Promise.resolve();
  const queuedOperation = previous.catch(() => undefined).then(operation);

  cloudCardAddQueues.set(
    queueKey,
    queuedOperation.then(
      () => undefined,
      () => undefined,
    ),
  );

  return queuedOperation;
}

async function waitForCloudCardAddition(ownerUserId: string | null) {
  const queue = cloudCardAddQueues.get(ownerUserId ?? "active-session");
  if (!queue) return;

  await queue.catch(() => undefined);
}

export function mergeCloudInventoryCards(
  cloudCards: InventoryCard[],
  localCards: InventoryCard[],
  pendingCardIds: ReadonlySet<string>,
  pendingCardMutations: ReadonlyMap<string, PendingCardMutation> = new Map(),
) {
  const pendingCards = localCards.filter((card) => pendingCardIds.has(card.cardId));
  const pendingIds = new Set(pendingCards.map((card) => card.cardId));
  const pendingMutationCards = localCards.filter((card) => {
    const mutation = pendingCardMutations.get(card.cardId);
    return mutation?.kind === "mark-learned";
  });
  pendingMutationCards.forEach((card) => pendingIds.add(card.cardId));

  const removedCardIds = new Set(
    [...pendingCardMutations.values()]
      .filter((mutation) => mutation.kind === "remove")
      .map((mutation) => mutation.cardId),
  );

  return [
    ...pendingCards,
    ...pendingMutationCards.filter((card) => !pendingCardIds.has(card.cardId)),
    ...cloudCards.filter(
      (card) => !pendingIds.has(card.cardId) && !removedCardIds.has(card.cardId),
    ),
  ];
}

async function createCustomCardThroughOfflineRoute(input: {
  language: LanguageCode;
  tier: Tier;
  termKind: TermKind;
  draft: GeneratedCardDraft;
  idempotencyKey?: string;
}): Promise<Awaited<ReturnType<typeof createCustomCardAction>>> {
  if (!input.idempotencyKey) throw new Error("offline_custom_card_idempotency_key_required");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("/api/cards/offline-create", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: input.idempotencyKey,
        language: input.language,
        tier: input.tier,
        termKind: input.termKind,
        term: input.draft.term,
        partOfSpeech: input.draft.partOfSpeech,
        pronunciation: input.draft.pronunciation,
        translations: input.draft.translations,
        examples: input.draft.examples.map((example) => ({
          sentence: example.example,
          translation: example.translation,
        })),
        definitions: input.draft.definitions,
        grammar: input.draft.grammar,
      }),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null) as Awaited<ReturnType<typeof createCustomCardAction>> | null;
    if (!result || (result.status !== "success" && result.status !== "error")) {
      throw new Error("offline_custom_card_invalid_response");
    }
    if (!response.ok && result.status !== "error") {
      throw new Error("offline_custom_card_request_failed");
    }
    return result;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function reconcileSettledCardMutations(
  cloudCards: InventoryCard[],
  pendingCardMutations: ReadonlyMap<string, PendingCardMutation>,
) {
  const cloudCardsById = new Map(cloudCards.map((card) => [card.cardId, card]));
  const next = new Map(pendingCardMutations);

  for (const [cardId, mutation] of pendingCardMutations) {
    if (mutation.state !== "settled") continue;

    const cloudCard = cloudCardsById.get(cardId);
    const mutationCommitted =
      mutation.kind === "remove"
        ? !cloudCard
        : cloudCard?.status === "learned";
    if (mutationCommitted) next.delete(cardId);
  }

  return next;
}

let optimisticCardMutationId = 0;

function nextOptimisticCardMutationId() {
  optimisticCardMutationId += 1;
  return optimisticCardMutationId;
}

function getCloudActionErrorMessage(result: { message?: string; errorCode?: string }) {
  const message = result.message?.trim();

  if (message) {
    return message;
  }

  return result.errorCode?.trim() || "unknown";
}

function dispatchFirstCardAddedEvent() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(FIRST_CARD_ADDED_EVENT));
}

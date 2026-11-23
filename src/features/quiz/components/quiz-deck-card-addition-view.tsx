"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppMessage } from "@/components/app-message-provider";
import { countActiveCardsForLanguage } from "@/features/inventory/active-card-limits";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { localCardRepository } from "@/features/cards/card-repository";
import { AchievementCardSection } from "@/features/quiz/components/quiz-achievement-card-section";
import { UpgradeDialog, type UpgradeDialogErrorCode } from "@/features/subscriptions/components/upgrade-dialog";
import { formatNumber } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { playSoundEffect } from "@/lib/sound-effects";
import { cn } from "@/lib/utils";
import type { InventoryCard, LanguageCode, Tier, VocabularyCard } from "@/types/domain";
import {
  QUIZ_END_ACTION_TAP_GUARD_GRACE_MS,
  QUIZ_END_CONTINUE_TRIPLE_TAP_WINDOW_MS,
} from "@/features/quiz/quiz-end-triple-tap";

const DECK_CARD_ADD_COUNT = 10;
const CARD_ADD_SINGLE_TAP_SETTLE_GRACE_MS = 50;
const QUIZ_FLOW_TRANSITION_MS = 360;
const QUIZ_FLOW_ENTER_DURATION_MS = 320;
const QUIZ_FLOW_EXIT_DURATION_MS = 160;
const QUIZ_FLOW_STAGGER_MS = 55;
const QUIZ_FLOW_SCALE_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
const CARD_TIERS: readonly Tier[] = ["A1", "A2", "B1", "B2", "C1"];

type CardTapSequence = {
  card: VocabularyCard;
  count: number;
  firstTapAt: number;
  timeoutId: number;
};

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function animateScaleSequence(elements: readonly HTMLElement[], direction: "enter" | "exit") {
  const orderedElements = direction === "exit" ? [...elements].reverse() : elements;
  const fromScale = direction === "enter" ? 0 : 1;
  const toScale = direction === "enter" ? 1 : 0;
  const duration = direction === "enter" ? QUIZ_FLOW_ENTER_DURATION_MS : QUIZ_FLOW_EXIT_DURATION_MS;

  return orderedElements.flatMap((element, index) => {
    if (typeof element.animate !== "function") return [];

    return [element.animate(
      [{ transform: `scale(${fromScale})` }, { transform: `scale(${toScale})` }],
      {
        duration,
        delay: index * QUIZ_FLOW_STAGGER_MS,
        easing: QUIZ_FLOW_SCALE_EASING,
        fill: "both",
      },
    )];
  });
}

interface QuizDeckCardAdditionViewProps {
  language: LanguageCode;
  onContinue: () => void;
  onActionPress: () => void;
}

export function QuizDeckCardAdditionView({
  language,
  onContinue,
  onActionPress,
}: QuizDeckCardAdditionViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const { showMessage } = useAppMessage();
  const addCard = useInventoryStore((state) => state.addCard);
  const [inventoryAtEntry] = useState(() => useInventoryStore.getState().cards);
  const [cards] = useState(() => selectDeckAdditionCards(inventoryAtEntry, language));
  const [exiting, setExiting] = useState(false);
  const [limitError, setLimitError] = useState<UpgradeDialogErrorCode | null>(null);
  const continueConsumedRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);
  const screenRef = useRef<HTMLElement>(null);
  const activeAnimationsRef = useRef<Animation[]>([]);
  const onContinueRef = useRef(onContinue);
  const pendingCardIdsRef = useRef(new Set<string>());
  const cardTapSequencesRef = useRef(new Map<string, CardTapSequence>());
  const cardTapGuardStartedAtRef = useRef<number | null>(null);
  const addedCardCountRef = useRef(0);
  const [entryAnimationComplete, setEntryAnimationComplete] = useState(false);
  const [ownedCardIds, setOwnedCardIds] = useState(
    () => new Set(inventoryAtEntry.map((inventoryCard) => inventoryCard.cardId)),
  );
  const [learningCardCount, setLearningCardCount] = useState(
    () => countActiveCardsForLanguage(inventoryAtEntry, language),
  );
  const title = t("quiz.deckAdd.title");
  const deckCount = t("quiz.deckAdd.count", { count: formatNumber(locale, learningCardCount) });

  useLayoutEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);

  useLayoutEffect(() => {
    cardTapGuardStartedAtRef.current = Date.now();

    if (prefersReducedMotion()) {
      setEntryAnimationComplete(true);
      return;
    }

    const items = Array.from(
      screenRef.current?.querySelectorAll<HTMLElement>("[data-quiz-deck-card-addition-item]") ?? [],
    );
    const animations = animateScaleSequence(items, "enter");
    if (animations.length === 0) {
      setEntryAnimationComplete(true);
      return;
    }

    activeAnimationsRef.current = animations;
    let effectActive = true;
    void Promise.all(animations.map((animation) => animation.finished))
      .then(() => {
        if (!effectActive) return;
        animations.forEach((animation) => animation.cancel());
        activeAnimationsRef.current = [];
        setEntryAnimationComplete(true);
      })
      .catch(() => {
        if (effectActive) setEntryAnimationComplete(true);
      });

    return () => {
      effectActive = false;
      animations.forEach((animation) => animation.cancel());
      activeAnimationsRef.current = [];
    };
  }, []);

  useEffect(() => () => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    for (const sequence of cardTapSequencesRef.current.values()) {
      window.clearTimeout(sequence.timeoutId);
    }
    cardTapSequencesRef.current.clear();
    activeAnimationsRef.current.forEach((animation) => animation.cancel());
  }, []);

  function clearCardTapSequences() {
    for (const sequence of cardTapSequencesRef.current.values()) {
      window.clearTimeout(sequence.timeoutId);
    }
    cardTapSequencesRef.current.clear();
  }

  function commitCardSelection(card: VocabularyCard) {
    if (exiting || pendingCardIdsRef.current.has(card.id)) return;

    const { cards: currentInventory, activeCardLimit } = useInventoryStore.getState();
    if (ownedCardIds.has(card.id) || ownedCardIds.has(card.sourceKey)) return;
    if (
      activeCardLimit !== null &&
      countActiveCardsForLanguage(currentInventory, language) >= activeCardLimit
    ) {
      setLimitError("free_active_card_limit");
      return;
    }

    pendingCardIdsRef.current.add(card.id);
    const addPromise = addCard(card.id);

    // addCard commits to the local inventory synchronously and persists in the
    // background. Keep this screen's feedback local so cloud reconciliation
    // cannot cause an extra count update or rerender the full card grid.
    const wasAddedImmediately = useInventoryStore.getState().cards !== currentInventory;
    if (wasAddedImmediately) {
      setOwnedCardIds((current) => new Set([...current, card.id, card.sourceKey]));
      setLearningCardCount((current) => current + 1);
      const playbackRate = Math.min(2.1, 1 + addedCardCountRef.current * 0.075);
      addedCardCountRef.current += 1;
      playSoundEffect("deck-card-add", { playbackRate });
    }

    void addPromise
      .then((result) => {
        if (result.limitReached) {
          setLimitError("free_active_card_limit");
        } else if (!result.ok) {
          showMessage(t("inventory.error.operationFailed"), "error");
        }
      })
      .catch(() => {
        showMessage(t("inventory.error.operationFailed"), "error");
      })
      .finally(() => {
        pendingCardIdsRef.current.delete(card.id);
      });
  }

  function handleCardSelect(card: VocabularyCard) {
    if (exiting) return;

    const now = Date.now();
    const previousSequence = cardTapSequencesRef.current.get(card.id);
    const tapGuardStartedAt = cardTapGuardStartedAtRef.current ?? now;
    const isScreenTapGuardActive = now - tapGuardStartedAt < QUIZ_END_ACTION_TAP_GUARD_GRACE_MS;
    const isSameGesture = previousSequence !== undefined
      && now - previousSequence.firstTapAt <= QUIZ_END_CONTINUE_TRIPLE_TAP_WINDOW_MS;

    if (!isScreenTapGuardActive && !previousSequence) {
      commitCardSelection(card);
      return;
    }

    if (previousSequence) {
      window.clearTimeout(previousSequence.timeoutId);
      if (!isSameGesture && previousSequence.count === 1) {
        commitCardSelection(previousSequence.card);
      }
      cardTapSequencesRef.current.delete(card.id);

      if (!isSameGesture && !isScreenTapGuardActive) {
        commitCardSelection(card);
        return;
      }
    }

    const sequence: CardTapSequence = isSameGesture && previousSequence
      ? previousSequence
      : {
          card,
          count: 0,
          firstTapAt: now,
          timeoutId: 0,
        };

    if (previousSequence) window.clearTimeout(previousSequence.timeoutId);
    sequence.count += 1;
    sequence.timeoutId = window.setTimeout(() => {
      if (cardTapSequencesRef.current.get(card.id) !== sequence) return;
      cardTapSequencesRef.current.delete(card.id);
      if (sequence.count === 1) commitCardSelection(sequence.card);
    }, Math.max(
      0,
      sequence.firstTapAt + QUIZ_END_CONTINUE_TRIPLE_TAP_WINDOW_MS + CARD_ADD_SINGLE_TAP_SETTLE_GRACE_MS - now,
    ));
    cardTapSequencesRef.current.set(card.id, sequence);
  }

  function handleContinue() {
    if (exiting || !entryAnimationComplete || continueConsumedRef.current) return;
    continueConsumedRef.current = true;
    clearCardTapSequences();
    onActionPress();
    setExiting(true);

    activeAnimationsRef.current.forEach((animation) => animation.cancel());
    activeAnimationsRef.current = [];

    if (prefersReducedMotion()) {
      onContinueRef.current();
      return;
    }

    const items = Array.from(
      screenRef.current?.querySelectorAll<HTMLElement>("[data-quiz-deck-card-addition-item]") ?? [],
    );
    const animations = animateScaleSequence(items, "exit");
    activeAnimationsRef.current = animations;

    let completed = false;
    const completeExit = () => {
      if (completed) return;
      completed = true;
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
      onContinueRef.current();
    };

    const expectedDuration = QUIZ_FLOW_EXIT_DURATION_MS + Math.max(0, items.length - 1) * QUIZ_FLOW_STAGGER_MS;
    const fallbackDuration = animations.length > 0
      ? Math.max(QUIZ_FLOW_TRANSITION_MS, expectedDuration + 200)
      : QUIZ_FLOW_TRANSITION_MS;
    exitTimerRef.current = window.setTimeout(completeExit, fallbackDuration);

    if (animations.length > 0) {
      void Promise.all(animations.map((animation) => animation.finished))
        .then(completeExit)
        .catch(() => {
          // Keep the failsafe active if the browser cancels a Web Animation.
        });
    }
  }

  return (
    <section
      ref={screenRef}
      data-quiz-deck-card-addition
      data-quiz-end-triple-tap-screen
      data-transition-state={exiting ? "exiting" : "entering"}
      className={cn(
        "absolute inset-0 z-50 flex min-h-0 w-full flex-col overflow-hidden",
        (!entryAnimationComplete || exiting) && "pointer-events-none",
      )}
    >
      <header className="flex-none px-4 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))] text-center sm:px-6 sm:pt-8">
        <h1
          data-quiz-deck-card-addition-title
          data-quiz-deck-card-addition-item="title"
          className={cn(
            "text-[2rem] font-bold leading-tight text-white sm:text-[2.5rem]",
            canUseSuperWater(locale) && "font-super-water",
          )}
        >
          {canUseSuperWater(locale) ? formatSuperWaterText(locale, title) : title}
        </h1>
        <p
          data-quiz-deck-card-addition-count
          data-quiz-deck-card-addition-item="count"
          className={cn(
            "mt-2 text-xl font-bold leading-tight text-emerald-400 sm:text-2xl",
            canUseSuperWater(locale) && "font-super-water",
          )}
          aria-live="polite"
        >
          {canUseSuperWater(locale) ? formatSuperWaterText(locale, deckCount) : deckCount}
        </p>
      </header>

      <div
        data-quiz-deck-card-addition-scroll
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:px-6"
      >
        {cards.length > 0 ? (
          <div className="mx-auto max-w-5xl">
            <AchievementCardSection
              title=""
              cards={cards}
              tone="learned"
              reveal
              exiting={exiting}
              staggerOffsetMs={0}
              animationMode="external"
              hideTitle
              showProgress={false}
              selectedCardIds={ownedCardIds}
              onCardSelect={handleCardSelect}
            />
          </div>
        ) : (
          <p
            data-quiz-deck-card-addition-item="empty"
            className="mx-auto mt-12 max-w-md px-4 text-center text-sm font-semibold text-foreground/55 sm:text-base"
          >
            {t("quiz.deckAdd.empty")}
          </p>
        )}
      </div>

      <div
        data-quiz-deck-card-addition-footer
        className="flex-none px-4 pt-4 pb-[calc(30px+env(safe-area-inset-bottom))] sm:px-6"
      >
        <button
          type="button"
          data-quiz-deck-card-addition-continue
          data-quiz-end-continue
          data-quiz-deck-card-addition-item="continue"
          data-tap-vibration="firm"
          disabled={!entryAnimationComplete || exiting}
          onClick={handleContinue}
          className={cn(
            "mx-auto block h-14 w-full max-w-md rounded-2xl bg-brand px-5 text-lg font-bold uppercase text-brand-foreground shadow-[0_6px_0_var(--brand-hover)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-1 active:shadow-[0_2px_0_var(--brand-hover)] disabled:pointer-events-none sm:h-16",
            canUseSuperWater(locale) && "font-super-water",
          )}
        >
          {canUseSuperWater(locale)
            ? formatSuperWaterText(locale, t("quiz.continue"))
            : t("quiz.continue")}
        </button>
      </div>

      <UpgradeDialog
        open={limitError !== null}
        errorCode={limitError}
        selectedLanguage={language}
        onOpenChange={(open) => {
          if (!open) setLimitError(null);
        }}
      />
    </section>
  );
}

function selectDeckAdditionCards(
  inventory: readonly InventoryCard[],
  language: LanguageCode,
) {
  const ownedSourceKeys = new Set<string>();
  const ownedTierCounts: Record<Tier, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
  const languageCards = localCardRepository.list({ language });
  const cardsByInventoryId = new Map<string, VocabularyCard>();

  for (const card of languageCards) {
    cardsByInventoryId.set(card.id, card);
    cardsByInventoryId.set(card.sourceKey, card);
  }

  for (const inventoryCard of inventory) {
    ownedSourceKeys.add(inventoryCard.cardId);
    const ownedCard = cardsByInventoryId.get(inventoryCard.cardId);
    if (ownedCard) {
      ownedSourceKeys.add(ownedCard.id);
      ownedSourceKeys.add(ownedCard.sourceKey);
    }
    if (!ownedCard) continue;
    ownedTierCounts[ownedCard.tier] += 1;
  }

  const hasOwnedTierWeights = CARD_TIERS.some((tier) => ownedTierCounts[tier] > 0);
  const allowedTiers = hasOwnedTierWeights
    ? CARD_TIERS.filter((tier) => ownedTierCounts[tier] > 0)
    : CARD_TIERS;
  const candidatesByTier = new Map<Tier, VocabularyCard[]>(
    allowedTiers.map((tier) => [tier, []]),
  );

  for (const card of languageCards) {
    if (card.termKind !== "word" || ownedSourceKeys.has(card.id) || ownedSourceKeys.has(card.sourceKey)) {
      continue;
    }
    candidatesByTier.get(card.tier)?.push(card);
  }

  const selected: VocabularyCard[] = [];
  while (selected.length < DECK_CARD_ADD_COUNT) {
    const availableTiers = allowedTiers.filter((tier) => (candidatesByTier.get(tier)?.length ?? 0) > 0);
    if (availableTiers.length === 0) break;

    const totalWeight = availableTiers.reduce(
      (total, tier) => total + (hasOwnedTierWeights ? ownedTierCounts[tier] : 1),
      0,
    );
    let weightedChoice = Math.random() * totalWeight;
    let selectedTier = availableTiers[availableTiers.length - 1];
    for (const tier of availableTiers) {
      weightedChoice -= hasOwnedTierWeights ? ownedTierCounts[tier] : 1;
      if (weightedChoice < 0) {
        selectedTier = tier;
        break;
      }
    }

    const tierCards = candidatesByTier.get(selectedTier)!;
    const cardIndex = Math.min(tierCards.length - 1, Math.floor(Math.random() * tierCards.length));
    selected.push(tierCards.splice(cardIndex, 1)[0]);
  }

  return selected;
}

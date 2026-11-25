"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Check, MessageCircleQuestion, Volume2, X } from "lucide-react";
import { CardGrammarDetailsButton, CardGrammarDetailsOverlay } from "@/features/cards/components/card-grammar-details-overlay";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { useAskOverlay } from "@/features/ask/components/ask-overlay-provider";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { useCardPronunciation } from "@/features/cards/card-pronunciation-client";
import { getCardDesignTierPalette } from "@/features/cards/card-design-tier-palette";
import { speakCardTerm } from "@/features/cards/card-speech";
import { useLocale, useT } from "@/i18n/locale-provider";
import { QuizPracticeSwipePrompt } from "@/features/quiz/components/quiz-practice-swipe-prompt";
import type { NormalQuizItem } from "@/features/quiz/quiz-pool-types";
import { formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";

const SWIPE_DISTANCE = 96;
const SWIPE_VELOCITY = 0.55;
const EXIT_DURATION_MS = 280;

type SwipeDirection = "left" | "right";

export function getEasyPracticePromptSide(cardKey: string): "native" | "learning" {
  let hash = 0x811c9dc5;
  for (let index = 0; index < cardKey.length; index += 1) {
    hash = Math.imul(hash ^ cardKey.charCodeAt(index), 0x01000193);
  }
  return (((hash >>> 0) ^ ((hash >>> 0) >>> 16)) & 1) === 0 ? "native" : "learning";
}

export function QuizPracticeSwipeCard({
  item,
  disabled = false,
  onReveal,
  onSwipe,
}: {
  item: NormalQuizItem;
  disabled?: boolean;
  onReveal?: () => void;
  onSwipe: (isCorrect: boolean) => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const { openAsk } = useAskOverlay();
  const requireAuth = useRequireAuthAction();
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [revealedCardId, setRevealedCardId] = useState<string | null>(null);
  const [exitDirection, setExitDirection] = useState<SwipeDirection | null>(null);
  const [exitDurationMs, setExitDurationMs] = useState(EXIT_DURATION_MS);
  const [grammarDetailsOpen, setGrammarDetailsOpen] = useState(false);
  const startRef = useRef<{ pointerId: number; x: number; y: number; time: number } | null>(null);
  const faceDownPointerRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const suppressRevealClickRef = useRef(false);
  const lockedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const onSwipeRef = useRef(onSwipe);
  const disabledRef = useRef(disabled);
  const tierColor = getCardDesignTierPalette(item.card.tier).badge;
  const isRevealed = revealedCardId === item.card.id;
  const promptSide = getEasyPracticePromptSide(item.card.sourceKey);
  const showNativeTranslation = promptSide === "native";
  const promptText = showNativeTranslation
    ? getPrimaryCardTranslation(item.card, locale) || item.card.translation || item.card.term
    : item.card.term;
  const { pronunciation } = useCardPronunciation(item.card);
  const pronunciationText = pronunciation.trim() || item.card.term;

  useEffect(() => {
    onSwipeRef.current = onSwipe;
  }, [onSwipe]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const submitSwipe = useCallback((direction: SwipeDirection) => {
    if (lockedRef.current || disabledRef.current || revealedCardId !== item.card.id) return;
    lockedRef.current = true;
    setDragging(false);
    setExitDirection(direction);
    const delay = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
      ? 80
      : EXIT_DURATION_MS;
    setExitDurationMs(delay);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onSwipeRef.current(direction === "right");
    }, delay);
  }, [item.card.id, revealedCardId]);

  function revealCard() {
    if (isRevealed || disabled || lockedRef.current) return;
    vibrate("flip");
    setRevealedCardId(item.card.id);
    onReveal?.();
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (
      disabled ||
      lockedRef.current ||
      event.isPrimary === false ||
      event.button !== 0 ||
      (target instanceof Element && target.closest("button, a, input, textarea, select"))
    ) return;

    if (!isRevealed) {
      faceDownPointerRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      suppressRevealClickRef.current = false;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture keeps a drag from turning into a synthetic tap when supported.
      }
      return;
    }

    startRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; pointer-up still completes the swipe.
    }
    setDrag({ x: 0, y: 0 });
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    if (!start || start.pointerId !== event.pointerId || lockedRef.current) return;
    setDrag({ x: event.clientX - start.x, y: event.clientY - start.y });
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const faceDownPointer = faceDownPointerRef.current;
    if (faceDownPointer?.pointerId === event.pointerId) {
      faceDownPointerRef.current = null;
      const movedX = event.clientX - faceDownPointer.x;
      const movedY = event.clientY - faceDownPointer.y;
      suppressRevealClickRef.current = Math.hypot(movedX, movedY) > 8;
      return;
    }

    const start = startRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    startRef.current = null;
    setDragging(false);
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const elapsedMs = Math.max(1, performance.now() - start.time);
    const velocityX = deltaX / elapsedMs;
    const direction = deltaX < 0 ? "left" : "right";
    const passedDistance = Math.abs(deltaX) >= SWIPE_DISTANCE;
    const passedFling = Math.abs(deltaX) >= 42
      && Math.abs(velocityX) >= SWIPE_VELOCITY
      && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

    if (passedDistance || passedFling) {
      submitSwipe(direction);
      return;
    }

    setDrag({ x: 0, y: 0 });
  }

  function handlePointerCancel() {
    faceDownPointerRef.current = null;
    suppressRevealClickRef.current = false;
    startRef.current = null;
    setDragging(false);
    if (!lockedRef.current) setDrag({ x: 0, y: 0 });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (!isRevealed) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        revealCard();
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      submitSwipe("left");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      submitSwipe("right");
    }
  }

  function handleCardClick() {
    if (suppressRevealClickRef.current) {
      suppressRevealClickRef.current = false;
      return;
    }
    revealCard();
  }

  function handleAskClick() {
    const nextPath = `/ask/${item.card.language}?term=${encodeURIComponent(item.card.term)}`;
    requireAuth(
      () => openAsk({ contextLanguage: item.card.language, initialTerm: item.card.term }),
      { nextPath },
    );
  }

  const visibleDirection = exitDirection ?? (drag.x === 0 ? null : drag.x < 0 ? "left" : "right");
  const isLearnedSwipe = visibleDirection === "right" && item.willLearn;
  const overlayClassName = visibleDirection === "left"
    ? "bg-red-500/85"
    : isLearnedSwipe
      ? "bg-sky-600/85"
      : "bg-emerald-500/85";
  const overlayLabel = visibleDirection === "left"
    ? t("quiz.practiceReviewAgain")
    : isLearnedSwipe
      ? t("quiz.practiceLearnedIt")
      : t("quiz.practiceUnderstood");
  const dragProgress = exitDirection ? 1 : Math.min(1, Math.abs(drag.x) / SWIPE_DISTANCE);
  const transform = exitDirection
    ? `translate3d(${exitDirection === "right" ? "115vw" : "-115vw"}, ${drag.y * 0.2}px, 0) rotate(${exitDirection === "right" ? 22 : -22}deg)`
    : `translate3d(${drag.x}px, ${drag.y * 0.22}px, 0) rotate(${drag.x / 20}deg)`;
  const askLabel = formatSuperWaterText(locale, t("cards.ask"));
  const practicePromptLabel = isRevealed
    ? t(item.willLearn ? "quiz.practiceSwipeLearnedPrompt" : "quiz.practiceSwipeProgressPrompt")
    : t("quiz.easyPracticeGuessAndTap");

  return (
    <div
      className="flex min-h-0 w-full flex-1 translate-y-[30px] flex-col items-center justify-center px-3 pb-4 pt-2 sm:px-6"
      data-quiz-practice-swipe
    >
      <QuizPracticeSwipePrompt
        item={item}
        isRevealed={isRevealed}
        className="mb-5 hidden w-full max-w-[22rem] lg:flex"
      />
      <div
        className="relative flex max-w-full touch-none flex-col items-center outline-none focus-visible:ring-4 focus-visible:ring-brand/50"
        role="group"
        tabIndex={disabled ? -1 : 0}
        aria-label={isRevealed
          ? `${item.card.term}. ${practicePromptLabel}`
          : `${promptText}. ${practicePromptLabel}`}
        aria-roledescription="swipe card"
        data-quiz-practice-swipe-card
        data-quiz-practice-card-revealed={isRevealed ? "true" : "false"}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
      >
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {exitDirection ? overlayLabel : ""}
        </span>
        <div
          className="card-draw-card-deal relative w-[min(72vw,20rem)] max-w-full"
          data-quiz-practice-card-deal
        >
          <div
            className="relative"
            style={{
              transform,
              transition: dragging
                ? "none"
                : `transform ${exitDirection ? exitDurationMs : 220}ms cubic-bezier(0.2, 0.75, 0.2, 1)`,
              touchAction: "none",
              willChange: "transform",
            } satisfies CSSProperties}
            data-swipe-card-motion={exitDirection ? "exiting" : dragging ? "dragging" : "idle"}
          >
            <div
              className="relative aspect-[3/4] w-full select-none overflow-hidden rounded-[12%/8.5%] shadow-sm shadow-black/30"
              data-quiz-practice-card-face
              aria-hidden={!isRevealed}
            >
              <VocabularyCardView
                card={item.card}
                inventory={item.inventoryCard}
                owned
                initialFace="back"
                face={isRevealed ? "front" : "back"}
                flippable={false}
                showActions={false}
                frontFit
                frontContentScale={1.1}
                className="h-full w-full"
              />
              {visibleDirection ? (
                <div
                  className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-[inherit] text-white transition-opacity duration-100 ${overlayClassName}`}
                  style={{ opacity: dragProgress }}
                  aria-hidden="true"
                  data-swipe-card-feedback={visibleDirection}
                >
                  {visibleDirection === "left" ? (
                    <X className="size-24 stroke-[3.5] text-white" aria-hidden="true" />
                  ) : (
                    <Check className="size-24 stroke-[3.5] text-white" aria-hidden="true" />
                  )}
                </div>
              ) : null}
              {visibleDirection ? (
                <span
                  className={cn(
                    "pointer-events-none absolute top-5 z-40 text-xl font-bold text-white",
                    visibleDirection === "left" ? "right-5" : "left-5",
                  )}
                  aria-hidden="true"
                  data-swipe-card-feedback-label
                >
                  {overlayLabel}
                </span>
              ) : null}
            </div>

            <div
              className="mt-[13px] flex min-h-[52px] w-full items-center justify-center gap-[13px]"
              data-quiz-practice-card-actions
            >
              {isRevealed ? (
                <>
                  <CardGrammarDetailsButton
                    onClick={() => setGrammarDetailsOpen(true)}
                    showIcon={false}
                    className="min-h-11 min-w-0 flex-1 justify-center whitespace-nowrap rounded-lg px-2 text-base"
                    style={{ backgroundColor: tierColor }}
                  />
                  <button
                    type="button"
                    aria-label={askLabel}
                    title={askLabel}
                    onClick={handleAskClick}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[var(--tier-a1)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    style={{ color: tierColor }}
                    data-quiz-practice-ask
                  >
                    <MessageCircleQuestion className="size-5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <div
                  className="flex min-w-0 flex-1 flex-col items-center justify-center text-center"
                  style={{ color: tierColor }}
                  data-quiz-practice-card-prompt
                  data-quiz-practice-card-prompt-side={showNativeTranslation ? "native" : "learning"}
                >
                  <p
                    className="max-w-full break-words text-[2.5rem] font-semibold leading-tight"
                    dir="auto"
                    lang={showNativeTranslation ? locale : item.card.language}
                    data-quiz-practice-card-prompt-text
                  >
                    {promptText}
                  </p>
                  {!showNativeTranslation ? (
                    <div className="mt-0.5 flex max-w-full items-center justify-center gap-1.5">
                      <span
                        className="max-w-[min(70vw,18rem)] break-words text-[1.75rem] leading-8"
                        data-quiz-practice-card-pronunciation
                      >
                        {pronunciationText}
                      </span>
                      <button
                        type="button"
                        aria-label={`${t("cards.pronunciation")}: ${item.card.term}`}
                        title={`${t("cards.pronunciation")}: ${item.card.term}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          speakCardTerm(item.card.term, item.card.language);
                        }}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-current transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                        data-quiz-practice-card-speak
                      >
                        <Volume2 className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <CardGrammarDetailsOverlay
        card={item.card}
        open={grammarDetailsOpen}
        nativeLocale={locale}
        onClose={() => setGrammarDetailsOpen(false)}
      />
    </div>
  );
}

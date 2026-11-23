"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Check, MessageCircleQuestion, X } from "lucide-react";
import { CardGrammarDetailsButton, CardGrammarDetailsOverlay } from "@/features/cards/components/card-grammar-details-overlay";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { useAskOverlay } from "@/features/ask/components/ask-overlay-provider";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { getCardDesignTierPalette } from "@/features/cards/card-design-tier-palette";
import { useLocale, useT } from "@/i18n/locale-provider";
import { QuizPracticeSwipePrompt } from "@/features/quiz/components/quiz-practice-swipe-prompt";
import type { NormalQuizItem } from "@/features/quiz/quiz-pool-types";
import { formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";

const SWIPE_DISTANCE = 96;
const SWIPE_VELOCITY = 0.55;
const EXIT_DURATION_MS = 280;

type SwipeDirection = "left" | "right";

export function QuizPracticeSwipeCard({
  item,
  disabled = false,
  onSwipe,
}: {
  item: NormalQuizItem;
  disabled?: boolean;
  onSwipe: (isCorrect: boolean) => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const { openAsk } = useAskOverlay();
  const requireAuth = useRequireAuthAction();
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<SwipeDirection | null>(null);
  const [exitDurationMs, setExitDurationMs] = useState(EXIT_DURATION_MS);
  const [grammarDetailsOpen, setGrammarDetailsOpen] = useState(false);
  const startRef = useRef<{ pointerId: number; x: number; y: number; time: number } | null>(null);
  const lockedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const onSwipeRef = useRef(onSwipe);
  const disabledRef = useRef(disabled);
  const tierColor = getCardDesignTierPalette(item.card.tier).badge;

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
    if (lockedRef.current || disabledRef.current) return;
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
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (
      disabled ||
      lockedRef.current ||
      event.isPrimary === false ||
      event.button !== 0 ||
      (target instanceof Element && target.closest("button, a, input, textarea, select"))
    ) return;

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
    startRef.current = null;
    setDragging(false);
    if (!lockedRef.current) setDrag({ x: 0, y: 0 });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      submitSwipe("left");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      submitSwipe("right");
    }
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

  return (
    <div
      className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-3 pb-4 pt-2 sm:px-6"
      data-quiz-practice-swipe
    >
      <QuizPracticeSwipePrompt
        item={item}
        className="mb-5 hidden w-full max-w-[22rem] lg:flex"
      />
      <div
        className="relative flex max-w-full touch-none flex-col items-center outline-none focus-visible:ring-4 focus-visible:ring-brand/50"
        role="group"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${item.card.term}. ${t(item.willLearn ? "quiz.practiceSwipeLearnedPrompt" : "quiz.practiceSwipeProgressPrompt")}`}
        aria-roledescription="swipe card"
        data-quiz-practice-swipe-card
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
            >
              <VocabularyCardView
                card={item.card}
                inventory={item.inventoryCard}
                owned
                initialFace="front"
                face="front"
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
              className="mt-[13px] flex w-full items-center justify-center gap-[13px]"
              data-quiz-practice-card-actions
            >
              <CardGrammarDetailsButton
                onClick={() => setGrammarDetailsOpen(true)}
                className="min-h-11 min-w-0 flex-1 justify-center whitespace-nowrap rounded-lg px-2 text-xs"
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

"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Check, RotateCcw } from "lucide-react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { useT } from "@/i18n/locale-provider";
import type { NormalQuizItem } from "@/features/quiz/quiz-pool-types";

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
  const t = useT();
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<SwipeDirection | null>(null);
  const [exitDurationMs, setExitDurationMs] = useState(EXIT_DURATION_MS);
  const startRef = useRef<{ pointerId: number; x: number; y: number; time: number } | null>(null);
  const lockedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const onSwipeRef = useRef(onSwipe);
  const disabledRef = useRef(disabled);

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
    if (disabled || lockedRef.current || event.isPrimary === false || event.button !== 0) return;
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
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      submitSwipe("left");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      submitSwipe("right");
    }
  }

  const visibleDirection = exitDirection ?? (drag.x === 0 ? null : drag.x < 0 ? "left" : "right");
  const isLearnedSwipe = visibleDirection === "right" && item.willLearn;
  const overlayClassName = visibleDirection === "left"
    ? "bg-rose-600"
    : isLearnedSwipe
      ? "bg-sky-600"
      : "bg-emerald-600";
  const overlayLabel = visibleDirection === "left"
    ? t("quiz.practiceReviewAgain")
    : isLearnedSwipe
      ? t("quiz.practiceLearnedIt")
      : t("quiz.practiceUnderstood");
  const dragProgress = exitDirection ? 1 : Math.min(1, Math.abs(drag.x) / SWIPE_DISTANCE);
  const transform = exitDirection
    ? `translate3d(${exitDirection === "right" ? "115vw" : "-115vw"}, ${drag.y * 0.2}px, 0) rotate(${exitDirection === "right" ? 22 : -22}deg)`
    : `translate3d(${drag.x}px, ${drag.y * 0.22}px, 0) rotate(${drag.x / 20}deg)`;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-3 pb-4 pt-2 sm:px-6" data-quiz-practice-swipe>
      <div
        className="relative aspect-[3/4] w-[min(76vw,21rem)] max-w-full select-none touch-none outline-none focus-visible:ring-4 focus-visible:ring-brand/50"
        role="group"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${item.card.term}. ${t("quiz.practiceSwipePrompt")}`}
        aria-roledescription="swipe card"
        data-quiz-practice-swipe-card
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {exitDirection ? overlayLabel : ""}
        </span>
        <div className="card-draw-card-deal absolute inset-0" data-quiz-practice-card-deal>
          <div
            className="absolute inset-0 overflow-hidden rounded-[12%/8.5%] shadow-sm shadow-black/30"
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
                className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[inherit] text-center text-white transition-opacity duration-100 ${overlayClassName}`}
                style={{ opacity: dragProgress * 0.84 }}
                aria-hidden="true"
                data-swipe-card-feedback={visibleDirection}
              >
                <div className="flex max-w-[88%] flex-col items-center gap-3 drop-shadow-md">
                  <span className="grid size-16 place-items-center rounded-full bg-white/20 ring-2 ring-white/75 sm:size-20">
                    {visibleDirection === "left"
                      ? <RotateCcw className="size-9 stroke-[3.25] sm:size-11" />
                      : <Check className="size-10 stroke-[3.5] sm:size-12" />}
                  </span>
                  <span className="text-balance text-2xl font-semibold leading-tight sm:text-3xl">
                    {overlayLabel}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <p className="mt-5 max-w-sm text-center text-sm leading-6 text-foreground-secondary" aria-hidden="true">
        {t("quiz.practiceSwipePrompt")}
      </p>
    </div>
  );
}

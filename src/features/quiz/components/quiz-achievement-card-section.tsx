"use client";

import { memo, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Check } from "lucide-react";
import { useLocale, useT } from "@/i18n/locale-provider";
import { TIER_REQUIREMENTS } from "@/data/tiers";
import { cn } from "@/lib/utils";
import { canUseSuperWater, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { QUIZ_END_ACTION_TAP_GUARD_GRACE_MS } from "@/features/quiz/quiz-end-triple-tap";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import type { VocabularyCard } from "@/types/domain";

const CARD_SELECTION_TAP_SLOP_PX = 6;
type SelectionPointerGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startScrollTop: number;
  startScrollLeft: number;
  scrollContainer: HTMLElement | null;
  moved: boolean;
};

export function AchievementCardSection({
  title,
  cards,
  tone,
  progressByCardId,
  reveal,
  exiting,
  staggerOffsetMs,
  hideTitle = false,
  showProgress = true,
  animationMode = "stagger",
  selectedCardIds,
  onCardSelect,
}: {
  title: string;
  cards: readonly VocabularyCard[];
  tone: "learned" | "advanced";
  progressByCardId?: Readonly<Record<string, number>>;
  reveal: boolean;
  exiting: boolean;
  staggerOffsetMs: number;
  hideTitle?: boolean;
  showProgress?: boolean;
  animationMode?: "stagger" | "external";
  selectedCardIds?: ReadonlySet<string>;
  onCardSelect?: (card: VocabularyCard) => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const [faceDownCardIds, setFaceDownCardIds] = useState<Set<string>>(() => new Set());
  const selectionEnabled = onCardSelect !== undefined;
  const cardIdKey = cards.map((card) => card.id).join("|");
  const tapGuardKey = `${selectionEnabled ? "select" : "flip"}:${cardIdKey}`;
  const [expiredTapGuardKey, setExpiredTapGuardKey] = useState<string | null>(null);
  const cardFlipTapGuardActive = !selectionEnabled && expiredTapGuardKey !== tapGuardKey;
  const selectionPointerRef = useRef<SelectionPointerGesture | null>(null);
  const suppressNextSelectionClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!reveal || exiting || typeof window === "undefined") return;

    const timers = Array.from({ length: cards.length }, (_, index) => window.setTimeout(
      () => {
        playSoundEffect("result-card-reveal");
        vibrate("reward-arrival");
      },
      staggerOffsetMs + 150 + index * 55,
    ));

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [cardIdKey, cards.length, exiting, reveal, staggerOffsetMs]);

  useEffect(() => {
    if (selectionEnabled || typeof window === "undefined") return;

    const timer = window.setTimeout(
      () => setExpiredTapGuardKey(tapGuardKey),
      QUIZ_END_ACTION_TAP_GUARD_GRACE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [selectionEnabled, tapGuardKey]);

  useEffect(() => {
    if (!selectionEnabled || typeof window === "undefined") return;

    const handlePointerMove = (event: PointerEvent) => {
      const gesture = selectionPointerRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId || gesture.moved) return;

      const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
      if (distance >= CARD_SELECTION_TAP_SLOP_PX) gesture.moved = true;
    };

    const handleScroll = () => {
      const gesture = selectionPointerRef.current;
      if (!gesture || gesture.moved || !gesture.scrollContainer) return;

      if (
        gesture.scrollContainer.scrollTop !== gesture.startScrollTop
        || gesture.scrollContainer.scrollLeft !== gesture.startScrollLeft
      ) {
        gesture.moved = true;
      }
    };

    const finishPointerGesture = (event: PointerEvent, canceled = false) => {
      const gesture = selectionPointerRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      if (
        canceled
        || Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) >= CARD_SELECTION_TAP_SLOP_PX
        || (gesture.scrollContainer && (
          gesture.scrollContainer.scrollTop !== gesture.startScrollTop
          || gesture.scrollContainer.scrollLeft !== gesture.startScrollLeft
        ))
      ) {
        gesture.moved = true;
      }
      if (gesture.moved) {
        suppressNextSelectionClickRef.current = true;
        if (suppressClickTimerRef.current !== null) window.clearTimeout(suppressClickTimerRef.current);
        suppressClickTimerRef.current = window.setTimeout(() => {
          suppressNextSelectionClickRef.current = false;
          suppressClickTimerRef.current = null;
        }, 0);
      }
      selectionPointerRef.current = null;
    };
    const handlePointerUp = (event: PointerEvent) => finishPointerGesture(event);
    const handlePointerCancel = (event: PointerEvent) => finishPointerGesture(event, true);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      if (suppressClickTimerRef.current !== null) window.clearTimeout(suppressClickTimerRef.current);
    };
  }, [selectionEnabled]);

  const handleSelectionPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (suppressClickTimerRef.current !== null) window.clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = null;
    suppressNextSelectionClickRef.current = false;
    const scrollContainer = event.currentTarget.closest<HTMLElement>("[data-quiz-deck-card-addition-scroll]");
    selectionPointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollTop: scrollContainer?.scrollTop ?? 0,
      startScrollLeft: scrollContainer?.scrollLeft ?? 0,
      scrollContainer,
      moved: false,
    };
  };

  const handleSelectionClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    card: VocabularyCard,
  ) => {
    if (suppressNextSelectionClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextSelectionClickRef.current = false;
      if (suppressClickTimerRef.current !== null) window.clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = null;
      return;
    }
    onCardSelect?.(card);
  };

  const handleCardClick = (cardId: string) => {
    if (cardFlipTapGuardActive) return;
    vibrate("flip");
    setFaceDownCardIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl p-3 sm:p-4"
      style={{ "--result-stagger-delay": `${staggerOffsetMs}ms` } as CSSProperties}
      data-chest-achievement-section={tone}
      data-quiz-achievement-section={tone}
    >
      {!hideTitle ? (
        <h2
          className={cn(
            "text-center text-3xl font-bold uppercase sm:text-4xl",
            exiting ? "result-stagger-exit" : reveal ? "result-stagger-enter" : "result-stagger-pending",
            canUseSuperWater(locale) && "font-super-water",
            tone === "learned" ? "text-sky-400" : "text-emerald-400",
          )}
          style={{ "--result-stagger-delay": `${staggerOffsetMs + 80}ms` } as CSSProperties}
        >
          {formatSuperWaterUppercaseText(locale, title)}
        </h2>
      ) : null}
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 lg:grid-cols-6">
        {cards.map((card, index) => {
          const isSelectable = selectionEnabled;
          const isSelected = selectedCardIds?.has(card.id) || selectedCardIds?.has(card.sourceKey) || false;

          return (
            <div
              key={`${tone}-${card.id}`}
              data-quiz-achievement-card={card.id}
              data-quiz-deck-card-addition-item={animationMode === "external" ? "card" : undefined}
              className={cn(
                "relative aspect-[5/6] min-w-0",
                isSelectable && !isSelected && "cursor-pointer",
                animationMode === "stagger"
                  ? exiting ? "result-stagger-exit" : reveal ? "result-stagger-enter" : "result-stagger-pending"
                  : undefined,
              )}
              style={{
                "--result-stagger-delay": `${staggerOffsetMs + 150 + index * 55}ms`,
              } as CSSProperties}
            >
              <VocabularyCardView
                card={card}
                inventory={isSelectable ? null : undefined}
                face={isSelectable || !faceDownCardIds.has(card.id) ? "front" : "back"}
                onClick={isSelectable ? undefined : () => handleCardClick(card.id)}
                compact
                owned={false}
                showActions={false}
                frontFit
                footerProgressCount={!showProgress
                  ? undefined
                  : tone === "learned"
                    ? TIER_REQUIREMENTS[card.tier]
                    : progressByCardId?.[card.id] ?? Math.max(1, TIER_REQUIREMENTS[card.tier] - 1)}
                className="h-full min-h-0 w-full"
              />
              {isSelectable ? (
                <button
                  type="button"
                  aria-label={`${card.term}: ${t("cards.addToDeck")}`}
                  aria-pressed={isSelected}
                  data-tap-vibration="firm"
                  disabled={isSelected}
                  onPointerDown={handleSelectionPointerDown}
                  onClick={(event) => handleSelectionClick(event, card)}
                  className="absolute inset-0 z-10 w-full touch-pan-y rounded-lg bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-default"
                  style={{ borderRadius: "12% / 8.5%" }}
                />
              ) : null}
              {isSelectable ? <CardSelectionOverlay key={isSelected ? "selected" : "idle"} selected={isSelected} /> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const CardSelectionOverlay = memo(function CardSelectionOverlay({ selected }: { selected: boolean }) {
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [checkVisible, setCheckVisible] = useState(false);

  useEffect(() => {
    if (!selected || typeof window === "undefined") return;
    const frame = window.requestAnimationFrame(() => setOverlayVisible(true));
    const fallback = window.setTimeout(() => setCheckVisible(true), 260);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, [selected]);

  return (
    <div
      data-card-add-overlay={selected ? "selected" : "idle"}
      aria-hidden="true"
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === "opacity" && selected) {
          setCheckVisible(true);
        }
      }}
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-lg bg-emerald-500/85 transition-opacity duration-[180ms] ease-[cubic-bezier(0.85,0,0.15,1)]",
        overlayVisible ? "opacity-100" : "opacity-0",
      )}
      style={{ borderRadius: "12% / 8.5%" }}
    >
      {selected ? (
        <span
          className={cn(
            "flex items-center justify-center transition-transform duration-[320ms] ease-[cubic-bezier(0.85,0,0.15,1)]",
            checkVisible ? "scale-100" : "scale-0",
          )}
        >
          <Check className="size-24 stroke-[3.5] text-white" aria-hidden="true" />
        </span>
      ) : null}
    </div>
  );
});

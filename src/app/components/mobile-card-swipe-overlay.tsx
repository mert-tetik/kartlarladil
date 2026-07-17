"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Check, X } from "lucide-react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { localCardRepository } from "@/features/cards/card-repository";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { TIERS } from "@/data/tiers";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LanguageCode, VocabularyCard } from "@/types/domain";

const THRESHOLD = 112;
const DEMO_KEY = "foxiesdeck:card-swipe-demo:shown";
const DEMO_START_DELAY = 1000;
const DEMO_SIDE_HOLD = 1800;
const CARD_EXIT_DURATION = 320;
const INCOMING_ENTRY_DELAY = 32;
const INCOMING_ENTRY_DURATION = 520;
const INCOMING_START_OFFSET = 180;
const OFFSCREEN_SIDE_OFFSET = 80;

type SwipeDirection = "skip" | "add";
type IncomingState = "idle" | "waiting" | "teleporting" | "preparing" | "entering";

export function MobileCardSwipeOverlay({ open, language, onClose }: { open: boolean; language: LanguageCode; onClose: () => void }) {
  const t = useT();
  const inventory = useInventoryStore((state) => state.cards);
  const addCard = useInventoryStore((state) => state.addCard);
  const [deck, setDeck] = useState<VocabularyCard[]>([]);
  const [demoX, setDemoX] = useState(0);
  const [swipeFeedback, setSwipeFeedback] = useState<SwipeDirection | null>(null);
  const [locked, setLocked] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [outgoing, setOutgoing] = useState<{ card: VocabularyCard; direction: SwipeDirection; active: boolean; x: number; rotation: number } | null>(null);
  const [incoming, setIncoming] = useState<IncomingState>("idle");
  const [incomingDirection, setIncomingDirection] = useState<SwipeDirection | null>(null);
  const [completedSwipes, setCompletedSwipes] = useState(0);
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);
  const swipeFeedbackRef = useRef<SwipeDirection | null>(null);
  const swipeAnimationActiveRef = useRef(false);
  const swipeInteractionActiveRef = useRef(false);
  const dragPosition = useRef({ x: 0, y: 0 });
  const queuedDragPosition = useRef({ x: 0, y: 0 });
  const dragFrame = useRef<number | null>(null);
  const card = deck[0] ?? null;
  const usedIds = useMemo(() => new Set(inventory.map((item) => item.cardId)), [inventory]);

  useEffect(() => {
    if (open) {
      let enterFrame: number | null = null;
      const mountFrame = window.requestAnimationFrame(() => {
        setMounted(true);
        enterFrame = window.requestAnimationFrame(() => setEntered(true));
      });

      return () => {
        window.cancelAnimationFrame(mountFrame);
        if (enterFrame) window.cancelAnimationFrame(enterFrame);
      };
    }

    const exitFrame = window.requestAnimationFrame(() => setEntered(false));
    const timer = window.setTimeout(() => setMounted(false), 300);

    return () => {
      window.cancelAnimationFrame(exitFrame);
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => () => {
    if (dragFrame.current !== null) {
      window.cancelAnimationFrame(dragFrame.current);
    }
  }, []);

  useEffect(() => {
    if (open) {
      const resetTimer = window.setTimeout(() => setCompletedSwipes(0), 0);
      return () => window.clearTimeout(resetTimer);
    }
  }, [open]);

  const loadDeck = useCallback(() => {
    const next = TIERS.flatMap((tier) => {
      const choices = localCardRepository.list({ language, tier }).filter((candidate) => !usedIds.has(candidate.sourceKey) && !usedIds.has(candidate.id));
      return choices.length ? [choices[Math.floor(Math.random() * choices.length)]] : [];
    });
    setDeck(next);
  }, [language, usedIds]);

  useEffect(() => {
    if (!open || typeof window === "undefined" || window.localStorage.getItem(DEMO_KEY)) return;
    const timers = [window.setTimeout(() => { setLocked(true); setDemoActive(true); setDragging(false); start.current = null; setDemoX(0); }, 0), window.setTimeout(() => setDemoX(-THRESHOLD - 12), DEMO_START_DELAY), window.setTimeout(() => setDemoX(THRESHOLD + 12), DEMO_START_DELAY + DEMO_SIDE_HOLD), window.setTimeout(() => setDemoX(0), DEMO_START_DELAY + DEMO_SIDE_HOLD * 2), window.setTimeout(() => { window.localStorage.setItem(DEMO_KEY, "1"); setDemoActive(false); setLocked(false); }, DEMO_START_DELAY + DEMO_SIDE_HOLD * 2 + 500)];
    return () => timers.forEach(window.clearTimeout);
  }, [open]);

  function finish(direction: SwipeDirection) {
    if (!card || locked) return;
    const currentPosition = dragPosition.current;
    const currentRotation = currentPosition.x / 18 + currentPosition.y / 90;

    cancelPendingDragFrame();
    swipeInteractionActiveRef.current = false;
    swipeAnimationActiveRef.current = true;
    setLocked(true);
    setDragging(false);
    setOutgoing({ card, direction, active: false, x: currentPosition.x, rotation: currentRotation });
    setDeck((current) => current.slice(1));
    setCompletedSwipes((count) => count + 1);
    setIncoming("waiting");
    setIncomingDirection(direction);
    const addedCardId = direction === "add" ? card.sourceKey : null;
    dragPosition.current = { x: 0, y: 0 };
    queuedDragPosition.current = { x: 0, y: 0 };
    swipeFeedbackRef.current = null;
    setSwipeFeedback(null);
    window.requestAnimationFrame(() => {
      setOutgoing((current) => current ? { ...current, active: true } : null);
    });
    window.setTimeout(() => {
      setOutgoing(null);
      setIncoming("teleporting");
      window.requestAnimationFrame(() => {
        setIncoming("preparing");
        window.setTimeout(() => setIncoming("entering"), INCOMING_ENTRY_DELAY);
      });
    }, CARD_EXIT_DURATION);
    window.setTimeout(() => {
      setIncoming("idle");
      setIncomingDirection(null);
      swipeAnimationActiveRef.current = false;
      setLocked(false);
      if (addedCardId) {
        scheduleCardAddInBackground(addedCardId);
      }
    }, CARD_EXIT_DURATION + INCOMING_ENTRY_DELAY + INCOMING_ENTRY_DURATION);
  }

  useEffect(() => {
    if (!open || deck.length !== 0 || locked) return;
    const timer = window.setTimeout(loadDeck, 0);
    return () => window.clearTimeout(timer);
  }, [deck.length, open, locked, loadDeck]);

  function resetDrag() {
    cancelPendingDragFrame();
    swipeInteractionActiveRef.current = false;
    start.current = null;
    dragPosition.current = { x: 0, y: 0 };
    queuedDragPosition.current = { x: 0, y: 0 };
    swipeFeedbackRef.current = null;
    setSwipeFeedback(null);
    setDragging(false);

    const cardElement = mainCardRef.current;
    if (!cardElement) return;

    cardElement.style.transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
    cardElement.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
    window.setTimeout(() => {
      if (mainCardRef.current !== cardElement) return;
      cardElement.style.removeProperty("transition");
      cardElement.style.removeProperty("transform");
    }, 280);
  }

  function cancelPendingDragFrame() {
    if (dragFrame.current !== null) {
      window.cancelAnimationFrame(dragFrame.current);
      dragFrame.current = null;
    }
  }

  function scheduleCardAddInBackground(cardId: string) {
    const run = () => {
      if (swipeAnimationActiveRef.current || swipeInteractionActiveRef.current) {
        window.setTimeout(run, 160);
        return;
      }

      void Promise.resolve(addCard(cardId)).catch(() => undefined);
    };
    const browserWindow = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };

    if (browserWindow.requestIdleCallback) {
      browserWindow.requestIdleCallback(run, { timeout: 1200 });
      return;
    }

    window.setTimeout(run, 0);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current || locked) return;

    const nextPosition = {
      x: event.clientX - start.current.x,
      y: event.clientY - start.current.y,
    };
    dragPosition.current = nextPosition;
    queuedDragPosition.current = nextPosition;

    if (dragFrame.current !== null) return;

    dragFrame.current = window.requestAnimationFrame(() => {
      dragFrame.current = null;
      const position = queuedDragPosition.current;
      const nextFeedback = position.x <= -THRESHOLD ? "skip" : position.x >= THRESHOLD ? "add" : null;

      if (swipeFeedbackRef.current !== nextFeedback) {
        swipeFeedbackRef.current = nextFeedback;
        setSwipeFeedback(nextFeedback);
      }

      const cardElement = mainCardRef.current;
      if (cardElement) {
        cardElement.style.transform = getCardTransform(position.x, position.y);
      }
    });
  }

  function finishDrag() {
    const { x } = dragPosition.current;
    start.current = null;

    if (x >= THRESHOLD) {
      finish("add");
      return;
    }

    if (x <= -THRESHOLD) {
      finish("skip");
      return;
    }

    resetDrag();
  }

  if (!mounted) return null;
  const leftActive = swipeFeedback === "skip" || demoX <= -THRESHOLD;
  const rightActive = swipeFeedback === "add" || demoX >= THRESHOLD;
  const incomingIsHidden = incoming === "waiting" || incoming === "teleporting" || incoming === "preparing";
  const incomingX = incoming === "teleporting"
    ? incomingDirection === "add" ? window.innerWidth + OFFSCREEN_SIDE_OFFSET : -window.innerWidth - OFFSCREEN_SIDE_OFFSET
    : 0;
  const incomingY = incoming === "idle" || incoming === "entering" ? 0 : INCOMING_START_OFFSET;
  const mainCardStyle: CSSProperties | undefined = incoming === "idle"
    ? demoActive ? { transform: getCardTransform(demoX, 0) } : undefined
    : { transform: `translate3d(${incomingX}px, ${incomingY}px, 0) rotate(0deg)`, opacity: incomingIsHidden ? 0 : 1 };
  const shouldRenderCard = card && incoming !== "waiting" && incoming !== "teleporting";
  return <div role="dialog" aria-modal="true" data-card-swipe-incoming-state={incoming} className={cn("fixed inset-0 z-[70] flex flex-col bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] transition-[opacity,transform] duration-300 ease-out lg:hidden", entered ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0")}>
    <div className="relative z-[60] flex items-center justify-between"><p className="text-sm font-semibold text-foreground-secondary">{t("cards.randomDrawTitle")}</p><button type="button" onClick={onClose} aria-label={t("common.close")} className="relative z-[70] inline-flex size-10 pointer-events-auto items-center justify-center rounded-md text-foreground"><X className="size-6" /></button></div>
    <div className="relative flex flex-1 -translate-y-8 items-center justify-center overflow-hidden">
      <p className={cn("pointer-events-none absolute inset-x-5 top-14 z-30 text-center text-sm font-bold leading-snug text-foreground transition-[opacity,transform] duration-300 ease-out", completedSwipes >= 3 ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100")}>
        {t("cards.swipeInstruction")}
      </p>
      {shouldRenderCard ? <div ref={mainCardRef} data-card-swipe-card onPointerDown={(event) => { if (!locked) { swipeInteractionActiveRef.current = true; start.current = { x: event.clientX, y: event.clientY }; dragPosition.current = { x: 0, y: 0 }; queuedDragPosition.current = { x: 0, y: 0 }; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.style.transition = "none"; } }} onPointerMove={handlePointerMove} onPointerUp={finishDrag} onPointerCancel={resetDrag} onLostPointerCapture={() => { if (start.current) resetDrag(); }} className={cn("relative z-10 w-[78vw] max-w-[300px] touch-none will-change-transform", dragging && !demoActive ? "" : "transition-[transform,opacity] duration-500 ease-out", locked ? "pointer-events-none" : "") } style={mainCardStyle}>
        <div data-card-swipe-state={leftActive ? "skip" : rightActive ? "add" : "idle"} className={cn("pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-lg transition-colors", leftActive ? "bg-red-500/85" : rightActive ? "bg-emerald-500/85" : "bg-transparent")}>
          {leftActive ? <X className="size-24 stroke-[3.5] text-white" aria-hidden="true" /> : null}
          {rightActive ? <Check className="size-24 stroke-[3.5] text-white" aria-hidden="true" /> : null}
        </div>
        {leftActive ? <span className="absolute right-5 top-5 z-30 text-xl font-bold text-white">{t("cards.skip")}</span> : null}
        {rightActive ? <span className="absolute left-5 top-5 z-30 text-xl font-bold text-white">{t("cards.addToDeck")}</span> : null}
        <VocabularyCardView card={card} initialFace="front" face="front" flippable={false} showActions={false} frontFit frontContentScale={1.25} className="aspect-[3/4] min-h-0 w-full max-sm:aspect-[3/4] max-sm:min-h-0" />
      </div> : null}
      {outgoing ? <div data-card-swipe-outgoing className="pointer-events-none absolute z-20 w-[78vw] max-w-[300px] will-change-transform transition-transform duration-300 ease-out" style={{ transform: outgoing.active ? `translate3d(${outgoing.x + (outgoing.direction === "add" ? window.innerWidth + OFFSCREEN_SIDE_OFFSET : -window.innerWidth - OFFSCREEN_SIDE_OFFSET)}px, 0, 0) rotate(${outgoing.rotation + (outgoing.direction === "add" ? 22 : -22)}deg)` : `translate3d(${outgoing.x}px, 0, 0) rotate(${outgoing.rotation}deg)` }}><OutgoingSwipeFeedback direction={outgoing.direction} /><VocabularyCardView card={outgoing.card} initialFace="front" face="front" flippable={false} showActions={false} frontFit frontContentScale={1.25} className="aspect-[3/4] min-h-0 w-full max-sm:aspect-[3/4] max-sm:min-h-0" /></div> : null}
    </div>
  </div>;
}

function getCardTransform(x: number, y: number) {
  return `translate3d(${x}px, ${y}px, 0) rotate(${x / 18 + y / 90}deg)`;
}

function OutgoingSwipeFeedback({ direction }: { direction: SwipeDirection }) {
  const t = useT();
  const isAdding = direction === "add";

  return (
    <>
      <div
        data-card-swipe-outgoing-state={direction}
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-lg",
          isAdding ? "bg-emerald-500/85" : "bg-red-500/85",
        )}
      >
        {isAdding ? <Check className="size-24 stroke-[3.5] text-white" aria-hidden="true" /> : <X className="size-24 stroke-[3.5] text-white" aria-hidden="true" />}
      </div>
      <span className={cn("absolute top-5 z-30 text-xl font-bold text-white", isAdding ? "left-5" : "right-5")}>
        {t(isAdding ? "cards.addToDeck" : "cards.skip")}
      </span>
    </>
  );
}

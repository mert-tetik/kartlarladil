"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export function MobileCardSwipeOverlay({ open, language, onClose }: { open: boolean; language: LanguageCode; onClose: () => void }) {
  const t = useT();
  const inventory = useInventoryStore((state) => state.cards);
  const addCard = useInventoryStore((state) => state.addCard);
  const [deck, setDeck] = useState<VocabularyCard[]>([]);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [locked, setLocked] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [outgoing, setOutgoing] = useState<{ card: VocabularyCard; direction: "skip" | "add"; active: boolean; x: number; rotation: number } | null>(null);
  const [incoming, setIncoming] = useState<"idle" | "preparing" | "entering">("idle");
  const [completedSwipes, setCompletedSwipes] = useState(0);
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragPosition = useRef({ x: 0, y: 0 });
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
    const timers = [window.setTimeout(() => { setLocked(true); setDemoActive(true); setDragging(false); start.current = null; setDragX(0); setDragY(0); }, 0), window.setTimeout(() => setDragX(-THRESHOLD - 12), DEMO_START_DELAY), window.setTimeout(() => setDragX(THRESHOLD + 12), DEMO_START_DELAY + DEMO_SIDE_HOLD), window.setTimeout(() => setDragX(0), DEMO_START_DELAY + DEMO_SIDE_HOLD * 2), window.setTimeout(() => { window.localStorage.setItem(DEMO_KEY, "1"); setDemoActive(false); setLocked(false); }, DEMO_START_DELAY + DEMO_SIDE_HOLD * 2 + 500)];
    return () => timers.forEach(window.clearTimeout);
  }, [open]);

  function finish(direction: "skip" | "add") {
    if (!card || locked) return;
    const currentPosition = dragPosition.current;
    const currentRotation = currentPosition.x / 18 + currentPosition.y / 90;

    setLocked(true);
    setDragging(false);
    setOutgoing({ card, direction, active: false, x: currentPosition.x, rotation: currentRotation });
    setDeck((current) => current.slice(1));
    setCompletedSwipes((count) => count + 1);
    setIncoming("preparing");
    if (direction === "add") void addCard(card.sourceKey);
    dragPosition.current = { x: 0, y: 0 };
    setDragX(0); setDragY(0);
    window.requestAnimationFrame(() => {
      setOutgoing((current) => current ? { ...current, active: true } : null);
      window.setTimeout(() => setIncoming("entering"), INCOMING_ENTRY_DELAY);
    });
    window.setTimeout(() => {
      setOutgoing(null);
    }, CARD_EXIT_DURATION);
    window.setTimeout(() => setLocked(false), INCOMING_ENTRY_DELAY + INCOMING_ENTRY_DURATION);
  }

  useEffect(() => {
    if (!open || deck.length !== 0 || locked) return;
    const timer = window.setTimeout(loadDeck, 0);
    return () => window.clearTimeout(timer);
  }, [deck.length, open, locked, loadDeck]);

  function resetDrag() {
    start.current = null;
    dragPosition.current = { x: 0, y: 0 };
    setDragging(false);
    setDragX(0);
    setDragY(0);
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
  const leftActive = dragX <= -THRESHOLD;
  const rightActive = dragX >= THRESHOLD;
  return <div role="dialog" aria-modal="true" className={cn("fixed inset-0 z-[70] flex flex-col bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] transition-[opacity,transform] duration-300 ease-out lg:hidden", entered ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0")}>
    <div className="relative z-[60] flex items-center justify-between"><p className="text-sm font-semibold text-foreground-secondary">{t("cards.randomDrawTitle")}</p><button type="button" onClick={onClose} aria-label={t("common.close")} className="relative z-[70] inline-flex size-10 pointer-events-auto items-center justify-center rounded-md text-foreground"><X className="size-6" /></button></div>
    <div className="relative flex flex-1 -translate-y-8 items-center justify-center overflow-hidden">
      <p className={cn("pointer-events-none absolute inset-x-5 top-14 z-30 text-center text-sm font-bold leading-snug text-foreground transition-[opacity,transform] duration-300 ease-out", completedSwipes >= 3 ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100")}>
        {t("cards.swipeInstruction")}
      </p>
      {card ? <div data-card-swipe-card onPointerDown={(event) => { if (!locked) { start.current = { x: event.clientX, y: event.clientY }; dragPosition.current = { x: 0, y: 0 }; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); } }} onPointerMove={(event) => { if (start.current && !locked) { const nextPosition = { x: event.clientX - start.current.x, y: event.clientY - start.current.y }; dragPosition.current = nextPosition; setDragX(nextPosition.x); setDragY(nextPosition.y); } }} onPointerUp={finishDrag} onPointerCancel={resetDrag} onLostPointerCapture={() => { if (start.current) resetDrag(); }} className={cn("relative z-10 w-[78vw] max-w-[300px] touch-none", dragging && !demoActive ? "" : "transition-[transform,opacity] duration-500 ease-out", locked ? "pointer-events-none" : "") } style={{ transform: `translate3d(${dragX}px, ${incoming === "preparing" ? INCOMING_START_OFFSET : 0}px, 0) rotate(${dragX / 18 + dragY / 90}deg)`, opacity: incoming === "preparing" ? 0 : 1 }}>
        <div data-card-swipe-state={leftActive ? "skip" : rightActive ? "add" : "idle"} className={cn("pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-lg transition-colors", leftActive ? "bg-red-500/85" : rightActive ? "bg-emerald-500/85" : "bg-transparent")}>
          {leftActive ? <X className="size-24 stroke-[3.5] text-white" aria-hidden="true" /> : null}
          {rightActive ? <Check className="size-24 stroke-[3.5] text-white" aria-hidden="true" /> : null}
        </div>
        {leftActive ? <span className="absolute right-5 top-5 z-30 text-xl font-bold text-white">{t("cards.skip")}</span> : null}
        {rightActive ? <span className="absolute left-5 top-5 z-30 text-xl font-bold text-white">{t("cards.addToDeck")}</span> : null}
        <VocabularyCardView card={card} initialFace="front" face="front" flippable={false} showActions={false} frontFit frontContentScale={1.25} className="aspect-[3/4] min-h-0 w-full max-sm:aspect-[3/4] max-sm:min-h-0" />
      </div> : null}
      {outgoing ? <div data-card-swipe-outgoing className="pointer-events-none absolute z-20 w-[78vw] max-w-[300px] transition-transform duration-300 ease-out" style={{ transform: outgoing.active ? `translate3d(${outgoing.x + (outgoing.direction === "add" ? window.innerWidth + 80 : -window.innerWidth - 80)}px, 0, 0) rotate(${outgoing.rotation + (outgoing.direction === "add" ? 22 : -22)}deg)` : `translate3d(${outgoing.x}px, 0, 0) rotate(${outgoing.rotation}deg)` }}><VocabularyCardView card={outgoing.card} initialFace="front" face="front" flippable={false} showActions={false} frontFit frontContentScale={1.25} className="aspect-[3/4] min-h-0 w-full max-sm:aspect-[3/4] max-sm:min-h-0" /></div> : null}
    </div>
  </div>;
}

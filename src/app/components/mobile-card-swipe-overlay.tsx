"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { localCardRepository } from "@/features/cards/card-repository";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { TIERS } from "@/data/tiers";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LanguageCode, VocabularyCard } from "@/types/domain";

const THRESHOLD = 112;
const DEMO_KEY = "foxiesdeck:card-swipe-demo:shown";
// Temporary visual-test mode. Set to false to restore the one-time demo behavior.
const REPLAY_DEMO_ON_EVERY_OPEN_FOR_TESTING = true;

export function MobileCardSwipeOverlay({ open, language, onClose }: { open: boolean; language: LanguageCode; onClose: () => void }) {
  const t = useT();
  const inventory = useInventoryStore((state) => state.cards);
  const addCard = useInventoryStore((state) => state.addCard);
  const [deck, setDeck] = useState<VocabularyCard[]>([]);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [locked, setLocked] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [outgoing, setOutgoing] = useState<{ card: VocabularyCard; direction: "skip" | "add"; active: boolean } | null>(null);
  const [incoming, setIncoming] = useState(false);
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

  const loadDeck = useCallback(() => {
    const next = TIERS.flatMap((tier) => {
      const choices = localCardRepository.list({ language, tier }).filter((candidate) => !usedIds.has(candidate.sourceKey) && !usedIds.has(candidate.id));
      return choices.length ? [choices[Math.floor(Math.random() * choices.length)]] : [];
    });
    setDeck(next);
  }, [language, usedIds]);

  useEffect(() => {
    if (!open || typeof window === "undefined" || (!REPLAY_DEMO_ON_EVERY_OPEN_FOR_TESTING && window.localStorage.getItem(DEMO_KEY))) return;
    const timers = [window.setTimeout(() => setLocked(true), 0), window.setTimeout(() => setDragX(-THRESHOLD - 12), 220), window.setTimeout(() => setDragX(THRESHOLD + 12), 1220), window.setTimeout(() => setDragX(0), 2220), window.setTimeout(() => { if (!REPLAY_DEMO_ON_EVERY_OPEN_FOR_TESTING) window.localStorage.setItem(DEMO_KEY, "1"); setLocked(false); }, 2700)];
    return () => timers.forEach(window.clearTimeout);
  }, [open]);

  function finish(direction: "skip" | "add") {
    if (!card || locked) return;
    setLocked(true);
    setDragging(false);
    setOutgoing({ card, direction, active: false });
    setDeck((current) => current.slice(1));
    setIncoming(true);
    dragPosition.current = { x: 0, y: 0 };
    setDragX(0); setDragY(0);
    window.requestAnimationFrame(() => {
      setOutgoing((current) => current ? { ...current, active: true } : null);
      window.requestAnimationFrame(() => setIncoming(false));
    });
    window.setTimeout(() => {
      if (direction === "add") void addCard(card.sourceKey);
      setOutgoing(null);
      setLocked(false);
    }, 280);
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
    <div className="flex items-center justify-between"><p className="text-sm font-semibold text-foreground-secondary">{t("nav.cardDraw")}</p><button type="button" onClick={onClose} aria-label={t("common.close")} className="inline-flex size-10 items-center justify-center rounded-md text-foreground"><X className="size-6" /></button></div>
    <div className="relative flex flex-1 -translate-y-8 items-center justify-center overflow-hidden">
      {card ? <div onPointerDown={(event) => { if (!locked) { start.current = { x: event.clientX, y: event.clientY }; dragPosition.current = { x: 0, y: 0 }; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); } }} onPointerMove={(event) => { if (start.current && !locked) { const nextPosition = { x: event.clientX - start.current.x, y: event.clientY - start.current.y }; dragPosition.current = nextPosition; setDragX(nextPosition.x); setDragY(nextPosition.y); } }} onPointerUp={finishDrag} onPointerCancel={resetDrag} onLostPointerCapture={() => { if (start.current) resetDrag(); }} className={cn("relative z-10 w-[78vw] max-w-[300px] touch-none", dragging ? "" : "transition-[transform,opacity] duration-[420ms] ease-out", locked ? "pointer-events-none" : "") } style={{ transform: `translate(${dragX}px, ${incoming ? "100dvh" : "0px"}) rotate(${dragX / 18 + dragY / 90}deg)`, opacity: incoming ? 0 : 1 }}>
        <div className={cn("pointer-events-none absolute inset-0 z-20 rounded-xl transition-colors", leftActive ? "bg-red-500/85" : rightActive ? "bg-emerald-500/85" : "bg-transparent")} />
        {leftActive ? <span className="absolute right-5 top-5 z-30 text-xl font-bold text-white">{t("cards.skip")}</span> : null}
        {rightActive ? <span className="absolute left-5 top-5 z-30 text-xl font-bold text-white">{t("cards.addToDeck")}</span> : null}
        <VocabularyCardView card={card} initialFace="front" face="front" flippable={false} showActions={false} frontFit className="aspect-[3/4] min-h-0 w-full max-sm:aspect-[3/4] max-sm:min-h-0" />
      </div> : null}
      {outgoing ? <div className="pointer-events-none absolute z-20 w-[78vw] max-w-[300px] transition-transform duration-300 ease-out" style={{ transform: outgoing.active ? `translateX(${outgoing.direction === "add" ? window.innerWidth : -window.innerWidth}px) rotate(${outgoing.direction === "add" ? 18 : -18}deg)` : "translateX(0)" }}><VocabularyCardView card={outgoing.card} initialFace="front" face="front" flippable={false} showActions={false} frontFit className="aspect-[3/4] min-h-0 w-full max-sm:aspect-[3/4] max-sm:min-h-0" /></div> : null}
    </div>
    <p className="text-center text-xs text-foreground-muted">{t("cards.swipeHint")}</p>
  </div>;
}

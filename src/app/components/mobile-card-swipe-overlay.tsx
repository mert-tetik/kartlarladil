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

export function MobileCardSwipeOverlay({ open, language, onClose }: { open: boolean; language: LanguageCode; onClose: () => void }) {
  const t = useT();
  const inventory = useInventoryStore((state) => state.cards);
  const addCard = useInventoryStore((state) => state.addCard);
  const [deck, setDeck] = useState<VocabularyCard[]>([]);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [locked, setLocked] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const card = deck[0] ?? null;
  const usedIds = useMemo(() => new Set(inventory.map((item) => item.cardId)), [inventory]);

  const loadDeck = useCallback(() => {
    const next = TIERS.flatMap((tier) => {
      const choices = localCardRepository.list({ language, tier }).filter((candidate) => !usedIds.has(candidate.sourceKey) && !usedIds.has(candidate.id));
      return choices.length ? [choices[Math.floor(Math.random() * choices.length)]] : [];
    });
    setDeck(next);
  }, [language, usedIds]);

  useEffect(() => {
    if (!open || typeof window === "undefined" || window.localStorage.getItem(DEMO_KEY)) return;
    const timers = [window.setTimeout(() => setLocked(true), 0), window.setTimeout(() => setDragX(-THRESHOLD - 12), 220), window.setTimeout(() => setDragX(THRESHOLD + 12), 1220), window.setTimeout(() => setDragX(0), 2220), window.setTimeout(() => { window.localStorage.setItem(DEMO_KEY, "1"); setLocked(false); }, 2700)];
    return () => timers.forEach(window.clearTimeout);
  }, [open]);

  function finish(direction: "skip" | "add") {
    if (!card || locked) return;
    setLocked(true);
    setDragX(direction === "add" ? window.innerWidth : -window.innerWidth);
    window.setTimeout(async () => {
      if (direction === "add") await addCard(card.sourceKey);
      setDeck((current) => current.slice(1));
      setDragX(0); setDragY(0); setLocked(false);
    }, 220);
  }

  useEffect(() => {
    if (!open || deck.length !== 0 || locked) return;
    const timer = window.setTimeout(loadDeck, 0);
    return () => window.clearTimeout(timer);
  }, [deck.length, open, locked, loadDeck]);
  if (!open) return null;
  const leftActive = dragX <= -THRESHOLD;
  const rightActive = dragX >= THRESHOLD;
  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-[70] flex flex-col bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] lg:hidden">
    <div className="flex items-center justify-between"><p className="text-sm font-semibold text-foreground-secondary">{t("nav.cardDraw")}</p><button type="button" onClick={onClose} aria-label={t("common.close")} className="inline-flex size-10 items-center justify-center rounded-md text-foreground"><X className="size-6" /></button></div>
    <div className="relative flex flex-1 items-center justify-center overflow-hidden">
      {card ? <div onPointerDown={(event) => { if (!locked) { start.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); } }} onPointerMove={(event) => { if (start.current && !locked) { setDragX(event.clientX - start.current.x); setDragY(event.clientY - start.current.y); } }} onPointerUp={() => { if (dragX >= THRESHOLD) finish("add"); else if (dragX <= -THRESHOLD) finish("skip"); else { setDragX(0); setDragY(0); } start.current = null; }} className={cn("relative w-full max-w-[330px] touch-none transition-transform duration-200", locked ? "pointer-events-none" : "") } style={{ transform: `translateX(${dragX}px) rotate(${dragX / 18 + dragY / 90}deg)` }}>
        <div className={cn("pointer-events-none absolute inset-0 z-20 rounded-xl transition-colors", leftActive ? "bg-red-500/85" : rightActive ? "bg-emerald-500/85" : "bg-transparent")} />
        {leftActive ? <span className="absolute right-5 top-5 z-30 text-xl font-bold text-white">{t("cards.skip")}</span> : null}
        {rightActive ? <span className="absolute left-5 top-5 z-30 text-xl font-bold text-white">{t("cards.addToDeck")}</span> : null}
        <VocabularyCardView card={card} initialFace="front" face="front" flippable={false} showActions={false} frontFit className="aspect-[3/4] w-full" />
      </div> : <p className="text-sm text-foreground-secondary">{t("inventory.emptyAnyDescription")}</p>}
    </div>
    <p className="text-center text-xs text-foreground-muted">{t("cards.swipeHint")}</p>
  </div>;
}

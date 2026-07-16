"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Library, Loader2, X } from "lucide-react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import { generateCardRequest } from "@/features/cards/create-card-client";
import { localCardRepository } from "@/features/cards/card-repository";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn, normalizeSearch } from "@/lib/utils";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";
import { TIERS } from "@/data/tiers";
import type { VocabularyCard } from "@/types/domain";

export function MobileCustomCardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale } = useLocale();
  const t = useT();
  const createCustomCard = useInventoryStore((state) => state.createCustomCard);
  const addCard = useInventoryStore((state) => state.addCard);
  const cards = useInventoryStore((state) => state.cards);
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<VocabularyCard | null>(null);
  const [aiResponse, setAiResponse] = useState<GeneratedCardResponse | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewRevealed, setPreviewRevealed] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragOffsetY = useRef(0);
  const loopCards = useMemo(
    () => TIERS.flatMap((tier) => localCardRepository.list({ tier }).slice(0, 1)),
    [],
  );

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
    const timer = window.setTimeout(() => setMounted(false), 320);
    return () => {
      window.cancelAnimationFrame(exitFrame);
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!preview) return;

    let expandFrame: number | null = null;
    const stageFrame = window.requestAnimationFrame(() => {
      expandFrame = window.requestAnimationFrame(() => setPreviewExpanded(true));
    });
    const revealTimer = window.setTimeout(() => setPreviewRevealed(true), 1350);

    return () => {
      window.cancelAnimationFrame(stageFrame);
      if (expandFrame) window.cancelAnimationFrame(expandFrame);
      window.clearTimeout(revealTimer);
    };
  }, [preview]);

  if (!mounted) return null;
  async function generate() {
    const normalized = normalizeSearch(term);
    if (!normalized) return;
    setLoading(true); setError(""); setPreview(null); setAiResponse(null); setPreviewExpanded(false); setPreviewRevealed(false);
    try {
      const match = localCardRepository.list({ query: term }).find((card) => normalizeSearch(card.term) === normalized) ?? localCardRepository.list({ query: term })[0];
      if (match) { setPreview(match); return; }
      const result = await generateCardRequest({ locale, term: term.trim() });
      setAiResponse(result); setPreview(buildPreviewVocabularyCard(result));
    } catch { setError(t("createCard.error.unknown")); } finally { setLoading(false); }
  }
  async function add() {
    if (!preview) return;
    setAdding(true); setError("");
    try {
      if (aiResponse) await createCustomCard({ language: aiResponse.language, tier: aiResponse.tier, termKind: aiResponse.termKind, draft: { term: aiResponse.term, partOfSpeech: aiResponse.partOfSpeech, pronunciation: aiResponse.pronunciation, translations: aiResponse.translations, example: aiResponse.example, exampleTranslation: aiResponse.exampleTranslation, grammar: aiResponse.grammar, termKind: aiResponse.termKind } });
      else {
        const result = await addCard(preview.sourceKey);
        if (!result.ok) throw new Error("add_failed");
      }
      setPreview(null); setAiResponse(null); setTerm(""); onClose();
    } catch { setError(t("createCard.error.addFailed")); } finally { setAdding(false); }
  }
  const alreadyAdded = preview ? cards.some((card) => card.cardId === preview.sourceKey || card.cardId === preview.id) : false;
  return <div role="dialog" aria-modal="true" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className={`fixed inset-0 z-[71] flex flex-col justify-end bg-black/50 transition-opacity duration-300 lg:hidden ${entered ? "opacity-100" : "pointer-events-none opacity-0"}`}>
    <div className={`flex h-[78dvh] max-h-[94dvh] flex-col overflow-y-auto rounded-t-xl bg-background-card p-5 shadow-sm transition-transform duration-300 ease-out ${entered ? "translate-y-0" : "translate-y-full"}`} style={{ transform: entered ? `translateY(${dragY}px)` : undefined }}>
      <div className="relative mb-4">
        <div
          onPointerDown={(event) => { if (entered) { dragStartY.current = event.clientY; dragOffsetY.current = 0; event.currentTarget.setPointerCapture(event.pointerId); } }}
          onPointerMove={(event) => { if (dragStartY.current !== null) { const nextOffset = Math.max(0, event.clientY - dragStartY.current); dragOffsetY.current = nextOffset; setDragY(nextOffset); } }}
          onPointerUp={() => { const shouldClose = dragOffsetY.current > 110; dragStartY.current = null; dragOffsetY.current = 0; if (shouldClose) onClose(); else setDragY(0); }}
          onPointerCancel={() => { dragStartY.current = null; dragOffsetY.current = 0; setDragY(0); }}
          className="mx-auto flex h-8 w-16 touch-none items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="absolute right-0 top-0 inline-flex size-9 items-center justify-center rounded-md text-foreground-secondary"><X className="size-5" /></button>
      </div>
      {!preview ? <div className="flex flex-1 flex-col"><input id="mobile-custom-term" value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t("createCard.termPlaceholder")} className="h-12 w-full rounded-md border border-border bg-background px-3 text-foreground outline-none" /><button type="button" disabled={!term.trim() || loading} onClick={generate} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-50">{loading ? <Loader2 className="size-4 animate-spin" /> : <Library className="size-4" />}{loading ? t("createCard.generating") : t("createCard.generate")}</button><CardBackLoop cards={loopCards} /></div> : <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden"><CardBackLoop cards={loopCards} className={cn("absolute inset-x-0 bottom-1 z-0 transition-opacity duration-300", previewRevealed ? "opacity-0" : "opacity-100")} /><div className="relative z-10 flex flex-1 flex-col items-center justify-center pb-12"><div className={cn("w-full max-w-[190px] opacity-100", previewExpanded ? "animate-mobile-custom-card-reveal-rise" : "translate-y-[38dvh] scale-[0.42]")}><VocabularyCardView card={preview} initialFace="back" face={previewRevealed ? "front" : "back"} flippable={false} showActions={false} frontFit className="aspect-[3/4] !min-h-0 w-full max-sm:!aspect-[3/4] max-sm:!min-h-0" /></div><div className={cn("mt-5 grid w-full grid-cols-2 gap-2 transition-[opacity,transform] duration-300 ease-out", previewRevealed ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}><button type="button" disabled={!previewRevealed} onClick={() => { setPreview(null); setAiResponse(null); setPreviewExpanded(false); setPreviewRevealed(false); }} className="h-10 rounded-md border border-border text-sm font-semibold text-foreground disabled:pointer-events-none">{t("common.back")}</button><button type="button" disabled={!previewRevealed || adding || alreadyAdded} onClick={add} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-50">{adding ? <Loader2 className="size-4 animate-spin" /> : null}{alreadyAdded ? t("createCard.alreadyInDeck") : t("createCard.add")}</button></div></div></div>}
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  </div>;
}

function CardBackLoop({ cards, className }: { cards: VocabularyCard[]; className?: string }) {
  if (!cards.length) return null;

  const sequence = [...cards, ...cards];

  return <div className={cn("mobile-custom-card-loop mt-auto pb-10 pt-7", className)} aria-hidden="true"><div className="mobile-custom-card-loop-track">{sequence.map((card, index) => <div key={`${card.id}-${index}`} className="w-[74px] shrink-0"><VocabularyCardView card={card} initialFace="back" face="back" flippable={false} showActions={false} compact className="aspect-[3/4] !min-h-0 w-full max-sm:!aspect-[3/4] max-sm:!min-h-0" /></div>)}</div></div>;
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
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

type LoopSlotOrigin = {
  slotId: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

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
  const [previewReturning, setPreviewReturning] = useState(false);
  const [previewOrigin, setPreviewOrigin] = useState<LoopSlotOrigin | null>(null);
  const [previewReturnPosition, setPreviewReturnPosition] = useState<LoopSlotOrigin | null>(null);
  const [sheetElement, setSheetElement] = useState<HTMLDivElement | null>(null);
  const [sheetSize, setSheetSize] = useState({ width: 390, height: 660 });
  const dragStartY = useRef<number | null>(null);
  const dragOffsetY = useRef(0);
  const returnTimer = useRef<number | null>(null);
  const returnMoveTimer = useRef<number | null>(null);
  const returnFrame = useRef<number | null>(null);
  const loopCards = useMemo(
    () => TIERS.flatMap((tier) => localCardRepository.list({ tier }).slice(0, 1)),
    [],
  );

  useEffect(() => {
    if (open) {
      const mountTimer = window.setTimeout(() => setMounted(true), 0);
      const enterTimer = window.setTimeout(() => setEntered(true), 32);

      return () => {
        window.clearTimeout(mountTimer);
        window.clearTimeout(enterTimer);
      };
    }
    const exitTimer = window.setTimeout(() => setEntered(false), 0);
    const timer = window.setTimeout(() => setMounted(false), 320);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!preview || previewReturning) return;

    const expandTimer = window.setTimeout(() => setPreviewExpanded(true), 48);
    const revealTimer = window.setTimeout(() => setPreviewRevealed(true), 820);

    return () => {
      window.clearTimeout(expandTimer);
      window.clearTimeout(revealTimer);
    };
  }, [preview, previewReturning]);

  useEffect(() => () => {
    if (returnTimer.current) window.clearTimeout(returnTimer.current);
    if (returnMoveTimer.current) window.clearTimeout(returnMoveTimer.current);
    if (returnFrame.current) window.cancelAnimationFrame(returnFrame.current);
  }, []);

  useEffect(() => {
    if (!sheetElement) return;

    const updateSize = () => {
      const nextSize = { width: sheetElement.clientWidth, height: sheetElement.clientHeight };
      setSheetSize((currentSize) => currentSize.width === nextSize.width && currentSize.height === nextSize.height ? currentSize : nextSize);
    };
    const measureTimer = window.setTimeout(updateSize, 0);
    const observer = new ResizeObserver(updateSize);
    observer.observe(sheetElement);

    return () => {
      window.clearTimeout(measureTimer);
      observer.disconnect();
    };
  }, [sheetElement]);

  if (!mounted) return null;
  const captureLoopOrigin = (tier: VocabularyCard["tier"], slotId?: string): LoopSlotOrigin | null => {
    const sheet = sheetElement;
    if (!sheet) return null;

    const sheetRect = sheet.getBoundingClientRect();
    const slots = Array.from(sheet.querySelectorAll<HTMLElement>("[data-mobile-custom-card-loop-slot]"))
      .filter((slot) => slot.dataset.loopTier === tier);
    const visibleSlots = slots.filter((slot) => {
      const rect = slot.getBoundingClientRect();
      return rect.right > sheetRect.left && rect.left < sheetRect.right;
    });
    const candidates = slotId
      ? slots.filter((slot) => slot.dataset.mobileCustomCardLoopSlot === slotId)
      : (visibleSlots.length ? visibleSlots : slots);
    const slot = [...candidates].sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const center = sheetRect.left + sheetRect.width / 2;
      return Math.abs(leftRect.left + leftRect.width / 2 - center) - Math.abs(rightRect.left + rightRect.width / 2 - center);
    })[0];
    if (!slot) return null;

    const rect = slot.getBoundingClientRect();
    return {
      slotId: slot.dataset.mobileCustomCardLoopSlot ?? `${tier}-0`,
      left: rect.left - sheetRect.left,
      top: rect.top - sheetRect.top,
      width: rect.width,
      height: rect.height,
    };
  };
  const showPreview = (card: VocabularyCard) => {
    setPreviewOrigin(captureLoopOrigin(card.tier));
    setPreview(card);
  };
  async function generate() {
    const normalized = normalizeSearch(term);
    if (!normalized) return;
    setLoading(true); setError(""); setPreview(null); setAiResponse(null); setPreviewExpanded(false); setPreviewRevealed(false); setPreviewReturning(false); setPreviewOrigin(null); setPreviewReturnPosition(null);
    try {
      const match = localCardRepository.list({ query: term }).find((card) => normalizeSearch(card.term) === normalized) ?? localCardRepository.list({ query: term })[0];
      if (match) { showPreview(match); return; }
      const result = await generateCardRequest({ locale, term: term.trim() });
      setAiResponse(result); showPreview(buildPreviewVocabularyCard(result));
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
  const previewTarget = {
    left: Math.max(0, (sheetSize.width - 190) / 2),
    top: Math.max(48, (sheetSize.height - 253) / 2 - 76),
    width: 190,
    height: 253,
  };
  const returnPreviewToLoop = () => {
    if (!preview || previewReturning) return;
    setPreviewRevealed(false);
    setPreviewReturning(true);
    returnMoveTimer.current = window.setTimeout(() => {
      const startTime = window.performance.now();
      const duration = 460;
      const animateReturn = (now: number) => {
        const progress = Math.min(1, (now - startTime) / duration);
        const easedProgress = 1 - (1 - progress) ** 3;
        const liveOrigin = captureLoopOrigin(preview.tier, previewOrigin?.slotId) ?? previewOrigin;
        if (liveOrigin) {
          setPreviewReturnPosition({
            ...liveOrigin,
            left: previewTarget.left + (liveOrigin.left - previewTarget.left) * easedProgress,
            top: previewTarget.top + (liveOrigin.top - previewTarget.top) * easedProgress,
            width: previewTarget.width + (liveOrigin.width - previewTarget.width) * easedProgress,
            height: previewTarget.height + (liveOrigin.height - previewTarget.height) * easedProgress,
          });
        }
        if (progress < 1) {
          returnFrame.current = window.requestAnimationFrame(animateReturn);
        }
      };
      returnFrame.current = window.requestAnimationFrame(animateReturn);
    }, 140);
    returnTimer.current = window.setTimeout(() => {
      setPreview(null);
      setAiResponse(null);
      setPreviewExpanded(false);
      setPreviewReturning(false);
      setPreviewOrigin(null);
      setPreviewReturnPosition(null);
      returnTimer.current = null;
      returnMoveTimer.current = null;
      returnFrame.current = null;
    }, 680);
  };
  const previewPosition = previewReturning && previewReturnPosition
    ? previewReturnPosition
    : previewExpanded
    ? previewTarget
    : previewOrigin
      ? previewOrigin
      : { left: previewTarget.left, top: sheetSize.height - 208, width: 92, height: 123 };
  const previewScale = previewPosition.width / previewTarget.width;
  const previewTransform = `translate3d(${previewPosition.left - previewTarget.left}px, ${previewPosition.top - previewTarget.top}px, 0) scale(${previewScale})`;
  return <div role="dialog" aria-modal="true" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className={`fixed inset-0 z-[71] flex flex-col justify-end bg-black/50 transition-opacity duration-300 lg:hidden ${entered ? "opacity-100" : "pointer-events-none opacity-0"}`}>
    <div ref={setSheetElement} className={`relative flex h-[78dvh] max-h-[94dvh] flex-col overflow-y-auto rounded-t-xl bg-background-card p-5 shadow-sm transition-transform duration-300 ease-out ${entered ? "translate-y-0" : "translate-y-full"}`} style={{ transform: entered ? `translateY(${dragY}px)` : undefined }}>
      <div className="relative z-30 mb-4">
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
      <CardBackLoop cards={loopCards} extractedSlotId={previewOrigin?.slotId} className="absolute inset-x-0 bottom-[4.5rem] z-0" />
      <div className={cn("relative z-10 flex flex-1 flex-col pt-12 transition-[opacity,transform] duration-300 ease-out", preview ? "pointer-events-none -translate-y-4 opacity-0" : "translate-y-0 opacity-100")}><input id="mobile-custom-term" value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t("createCard.termPlaceholder")} className="h-12 w-full rounded-md border border-brand bg-white px-3 text-black outline-none placeholder:text-black/50" /><button type="button" disabled={!term.trim() || loading} onClick={generate} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-50">{loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}{loading ? t("createCard.generating") : t("createCard.generate")}</button></div>
      {preview ? <><div className="absolute z-20 h-[253px] w-[190px]" style={{ left: `${previewTarget.left}px`, top: `${previewTarget.top}px` }}><div className={cn("size-full origin-top-left", !previewReturning && "transition-transform duration-700 ease-out")} style={{ transform: previewTransform }}><VocabularyCardView card={preview} initialFace="back" face={previewRevealed && !previewReturning ? "front" : "back"} flippable={false} showActions={false} frontFit className="aspect-[3/4] !min-h-0 size-full max-sm:!aspect-[3/4] max-sm:!min-h-0" /></div></div><div className={cn("absolute inset-x-5 z-20 grid grid-cols-2 gap-2 transition-[opacity,transform] duration-300 ease-out", previewRevealed && !previewReturning ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")} style={{ top: `${previewTarget.top + previewTarget.height + 16}px` }}><button data-mobile-custom-card-preview-back type="button" disabled={!previewRevealed || previewReturning} onClick={returnPreviewToLoop} className="h-10 rounded-md bg-red-500 text-sm font-semibold text-white disabled:pointer-events-none">{t("common.back")}</button><button type="button" disabled={!previewRevealed || previewReturning || adding || alreadyAdded} onClick={add} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-500 text-sm font-semibold text-white disabled:opacity-50">{adding ? <Loader2 className="size-4 animate-spin" /> : null}{alreadyAdded ? t("createCard.alreadyInDeck") : t("createCard.add")}</button></div></> : null}
      {error ? <p role="alert" className="relative z-30 mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  </div>;
}

function CardBackLoop({ cards, extractedSlotId, className }: { cards: VocabularyCard[]; extractedSlotId?: string; className?: string }) {
  if (!cards.length) return null;

  const sequence = [...cards, ...cards];

  return <div className={cn("mobile-custom-card-loop mt-auto pb-24 pt-7", className)} aria-hidden="true"><div className="mobile-custom-card-loop-track">{sequence.map((card, index) => { const slotId = `${card.tier}-${index}`; return <div key={`${card.id}-${index}`} data-mobile-custom-card-loop-slot={slotId} data-loop-tier={card.tier} className="aspect-[3/4] w-[92px] shrink-0">{slotId === extractedSlotId ? null : <VocabularyCardView card={card} initialFace="back" face="back" flippable={false} showActions={false} compact className="aspect-[3/4] !min-h-0 w-full max-sm:!aspect-[3/4] max-sm:!min-h-0" />}</div>; })}</div></div>;
}

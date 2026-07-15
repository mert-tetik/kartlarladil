"use client";

import { useState } from "react";
import { Library, Loader2, X } from "lucide-react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import { generateCardRequest } from "@/features/cards/create-card-client";
import { localCardRepository } from "@/features/cards/card-repository";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useLocale, useT } from "@/i18n/locale-provider";
import { normalizeSearch } from "@/lib/utils";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";
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

  if (!open) return null;
  async function generate() {
    const normalized = normalizeSearch(term);
    if (!normalized) return;
    setLoading(true); setError(""); setPreview(null); setAiResponse(null);
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
  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-[71] flex flex-col justify-end bg-black/50 lg:hidden">
    <div className="max-h-[88dvh] rounded-t-xl bg-background-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><Library className="size-5 text-brand" /><h2 className="text-lg font-semibold text-foreground">{t("cards.createCustom")}</h2></div><button type="button" onClick={onClose} aria-label={t("common.close")} className="inline-flex size-9 items-center justify-center rounded-md text-foreground-secondary"><X className="size-5" /></button></div>
      {!preview ? <><label htmlFor="mobile-custom-term" className="text-sm font-medium text-foreground">{t("createCard.term")}</label><input id="mobile-custom-term" value={term} onChange={(event) => setTerm(event.target.value)} placeholder={t("createCard.termPlaceholder")} className="mt-2 h-12 w-full rounded-md border border-border bg-background px-3 text-foreground outline-none" /><button type="button" disabled={!term.trim() || loading} onClick={generate} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-50">{loading ? <Loader2 className="size-4 animate-spin" /> : <Library className="size-4" />}{loading ? t("createCard.generating") : t("createCard.generate")}</button></> : <div className="space-y-3"><div className="mx-auto w-full max-w-[190px]"><VocabularyCardView card={preview} initialFace="front" face="front" flippable={false} showActions={false} frontFit className="aspect-[3/4] w-full" /></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setPreview(null); setAiResponse(null); }} className="h-10 rounded-md border border-border text-sm font-semibold text-foreground">{t("common.back")}</button><button type="button" disabled={adding || alreadyAdded} onClick={add} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand text-sm font-semibold text-brand-foreground disabled:opacity-50">{adding ? <Loader2 className="size-4 animate-spin" /> : null}{alreadyAdded ? t("createCard.alreadyInDeck") : t("createCard.add")}</button></div></div>}
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  </div>;
}

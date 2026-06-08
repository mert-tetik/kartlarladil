"use client";

import { useState } from "react";
import { Check, Info, Plus, Volume2, X } from "lucide-react";
import { LANGUAGE_NAMES } from "@/data/languages";
import { TIER_LABELS, TIER_REQUIREMENTS, TIER_STYLES } from "@/data/tiers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CardDetailsDialog } from "@/features/cards/components/card-details-dialog";
import type { InventoryCard, VocabularyCard } from "@/types/domain";

export function VocabularyCardView({
  card,
  inventory,
  owned,
  compact = false,
  onAdd,
  onSkip,
}: {
  card: VocabularyCard;
  inventory?: InventoryCard;
  owned?: boolean;
  compact?: boolean;
  onAdd?: () => void;
  onSkip?: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const style = TIER_STYLES[card.tier];
  const requirement = TIER_REQUIREMENTS[card.tier];
  const progress = inventory ? Math.min(100, (inventory.correctCount / requirement) * 100) : 0;
  const learned = inventory?.status === "learned";
  const showDetails = !compact;

  return (
    <article
      className={cn(
        "group relative flex aspect-[3/4] min-w-0 flex-col overflow-hidden rounded-lg border bg-gradient-to-br shadow-sm",
        compact ? "p-3 xl:p-4" : "min-h-[320px] p-4",
        style.border,
        style.surface,
      )}
    >
      <div className={cn("pointer-events-none absolute h-px bg-slate-900/10", compact ? "inset-x-3 top-12 xl:inset-x-4 xl:top-14" : "inset-x-4 top-14")} />
      <div className={cn("pointer-events-none absolute h-px bg-slate-900/10", compact ? "inset-x-3 bottom-14 xl:inset-x-4 xl:bottom-20" : "inset-x-4 bottom-20")} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge className={cn("border-transparent bg-white/80", style.text)}>
            {card.tier} · {TIER_LABELS[card.tier]}
          </Badge>
          <p className="mt-3 text-xs font-semibold text-slate-500">{LANGUAGE_NAMES[card.language]}</p>
        </div>
        <div className="flex items-center gap-2">
          {showDetails ? (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={`${card.term} detayları`}
              title="Kart detayları"
              onClick={() => setDetailsOpen(true)}
              className="size-9 border-white/70 bg-white/80"
            >
              <Info className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          <span className={cn("size-3 rounded-full", style.accent)} aria-hidden="true" />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center py-6">
        <div className="flex items-center gap-2 text-slate-500">
          <Volume2 className="size-4" aria-hidden="true" />
          <span className="text-sm">{card.pronunciation}</span>
        </div>
        <h3
          className={cn(
            "mt-3 font-display font-semibold leading-none text-slate-950",
            compact ? "text-2xl xl:text-3xl" : "text-4xl",
          )}
        >
          {card.term}
        </h3>
        <p className="mt-3 text-sm font-semibold text-slate-500">{card.partOfSpeech}</p>
        {!compact ? (
          <p className="mt-5 text-lg font-semibold text-slate-800">{card.translation}</p>
        ) : null}
      </div>

      {!compact ? (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-slate-700">{card.example}</p>
          <p className="text-xs leading-5 text-slate-500">{card.exampleTranslation}</p>
        </div>
      ) : null}

      {inventory ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>{learned ? "Öğrenildi" : "İlerleme"}</span>
            <span>
              {inventory.correctCount}/{requirement}
            </span>
          </div>
          <Progress value={progress} indicatorClassName={style.accent} />
        </div>
      ) : null}

      {onAdd || onSkip ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onSkip} disabled={!onSkip}>
            <X className="size-4" aria-hidden="true" />
            Geç
          </Button>
          <Button onClick={onAdd} disabled={owned || !onAdd}>
            {owned ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {owned ? "Haznede" : "Ekle"}
          </Button>
        </div>
      ) : null}

      {showDetails ? <CardDetailsDialog card={card} open={detailsOpen} onOpenChange={setDetailsOpen} /> : null}
    </article>
  );
}

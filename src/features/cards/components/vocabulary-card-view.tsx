"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Check, Info, Layers3, Plus, Volume2, X } from "lucide-react";
import { LANGUAGE_NAMES } from "@/data/languages";
import { TIER_LABELS, TIER_REQUIREMENTS, TIER_STYLES } from "@/data/tiers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CardDetailsDialog } from "@/features/cards/components/card-details-dialog";
import type { InventoryCard, VocabularyCard } from "@/types/domain";

type CardFace = "front" | "back";

interface VocabularyCardViewProps {
  card: VocabularyCard;
  inventory?: InventoryCard;
  owned?: boolean;
  compact?: boolean;
  initialFace?: CardFace;
  flippable?: boolean;
  onAdd?: () => void;
  onSkip?: () => void;
}

interface CardFaceState {
  cardId: string;
  initialFace: CardFace;
  isFaceUp: boolean;
}

export function VocabularyCardView({
  card,
  inventory,
  owned,
  compact = false,
  initialFace = "front",
  flippable = false,
  onAdd,
  onSkip,
}: VocabularyCardViewProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [faceState, setFaceState] = useState<CardFaceState>(() => ({
    cardId: card.id,
    initialFace,
    isFaceUp: initialFace === "front",
  }));
  const style = TIER_STYLES[card.tier];
  const requirement = TIER_REQUIREMENTS[card.tier];
  const progress = inventory ? Math.min(100, (inventory.correctCount / requirement) * 100) : 0;
  const learned = inventory?.status === "learned";
  const showDetails = !compact;
  const examplePreview = card.examples[0]?.sentence ?? card.example;
  const isFaceUp =
    faceState.cardId === card.id && faceState.initialFace === initialFace
      ? faceState.isFaceUp
      : initialFace === "front";

  function revealFront() {
    if (flippable && !isFaceUp) {
      setFaceState({ cardId: card.id, initialFace, isFaceUp: true });
    }
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!flippable || isFaceUp || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    revealFront();
  }

  function handleDetailsClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setDetailsOpen(true);
  }

  function handleSkipClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onSkip?.();
  }

  function handleAddClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onAdd?.();
  }

  const flipRoleProps =
    flippable && !isFaceUp
      ? {
          role: "button",
          tabIndex: 0,
          "aria-label": `${card.term} kartını çevir`,
          "aria-pressed": false,
          onClick: revealFront,
          onKeyDown: handleCardKeyDown,
        }
      : {};

  return (
    <article
      data-card-face={isFaceUp ? "front" : "back"}
      {...flipRoleProps}
      className={cn(
        "group relative aspect-[3/4] min-w-0 rounded-lg [perspective:1200px]",
        compact ? "" : "min-h-[320px]",
        flippable && !isFaceUp && "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
      )}
    >
      <div
        className={cn(
          "relative h-full min-h-[inherit] w-full transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none",
          isFaceUp ? "[transform:rotateY(0deg)]" : "[transform:rotateY(180deg)]",
        )}
      >
        <div
          aria-hidden={!isFaceUp}
          inert={!isFaceUp}
          className={cn(
            "absolute inset-0 flex flex-col overflow-hidden rounded-lg border bg-gradient-to-br shadow-sm [backface-visibility:hidden]",
            compact ? "p-3 xl:p-4" : "p-4",
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
                  onClick={handleDetailsClick}
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
            <p className="truncate text-sm leading-6 text-slate-700" title={examplePreview}>
              {examplePreview}
            </p>
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
              <Button variant="secondary" onClick={handleSkipClick} disabled={!onSkip}>
                <X className="size-4" aria-hidden="true" />
                Geç
              </Button>
              <Button onClick={handleAddClick} disabled={owned || !onAdd}>
                {owned ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                {owned ? "Haznede" : "Ekle"}
              </Button>
            </div>
          ) : null}
        </div>

        <div
          aria-hidden={isFaceUp}
          inert={isFaceUp}
          className={cn(
            "absolute inset-0 flex overflow-hidden rounded-lg border bg-gradient-to-br shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]",
            compact ? "p-3 xl:p-4" : "p-4",
            style.border,
            style.surface,
          )}
        >
          <div className="pointer-events-none absolute inset-4 rounded-md border border-white/70" />
          <div className="pointer-events-none absolute inset-x-8 top-20 h-px bg-slate-900/10" />
          <div className="pointer-events-none absolute inset-x-8 bottom-20 h-px bg-slate-900/10" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(90deg,#0f172a_1px,transparent_1px),linear-gradient(0deg,#0f172a_1px,transparent_1px)] [background-size:18px_18px]" />

          <div className="relative flex flex-1 flex-col">
            <div className="flex items-start justify-between gap-3">
              <Badge className={cn("border-transparent bg-white/80", style.text)}>
                {card.tier} · {TIER_LABELS[card.tier]}
              </Badge>
              <span className={cn("size-3 rounded-full", style.accent)} aria-hidden="true" />
            </div>

            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className={cn("flex size-14 items-center justify-center rounded-md text-white shadow-sm", style.accent)}>
                <Layers3 className="size-7" aria-hidden="true" />
              </div>
              <p className={cn("mt-5 font-display font-semibold leading-none", compact ? "text-5xl" : "text-6xl", style.text)}>
                {card.tier}
              </p>
              <p className="mt-4 text-sm font-semibold text-slate-600">{LANGUAGE_NAMES[card.language]}</p>
              <p className="mt-2 text-sm text-slate-500">Çevirmek için tıkla</p>
            </div>

            <div className="flex items-end justify-between gap-3 text-xs font-semibold text-slate-500">
              <span>{TIER_LABELS[card.tier]}</span>
              <span>Kartlarla Dil</span>
            </div>
          </div>
        </div>
      </div>

      {showDetails ? <CardDetailsDialog card={card} open={detailsOpen} onOpenChange={setDetailsOpen} /> : null}
    </article>
  );
}

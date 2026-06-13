"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Check, Coins, Info, Plus, Volume2, X } from "lucide-react";
import { LANGUAGE_NAMES } from "@/data/languages";
import { TIER_LABELS, TIER_REQUIREMENTS, TIER_STYLES } from "@/data/tiers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CardDetailsDialog } from "@/features/cards/components/card-details-dialog";
import { getPointsForTier } from "@/features/progress/progress-stats";
import type { InventoryCard, Tier, VocabularyCard } from "@/types/domain";

type CardFace = "front" | "back";

interface VocabularyCardViewProps {
  card: VocabularyCard;
  inventory?: InventoryCard;
  owned?: boolean;
  compact?: boolean;
  initialFace?: CardFace;
  flippable?: boolean;
  backDisplayTier?: Tier;
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
  backDisplayTier,
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
  const tierPoints = getPointsForTier(card.tier);
  const progress = inventory ? Math.min(100, (inventory.correctCount / requirement) * 100) : 0;
  const learned = inventory?.status === "learned";
  const showDetails = !compact;
  const examplePreview = card.examples[0]?.sentence ?? card.example;
  const visibleBackTier = backDisplayTier ?? card.tier;
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
              <div className="mt-3 flex translate-y-1 items-center gap-2 text-xs font-semibold text-slate-500">
                <span>{LANGUAGE_NAMES[card.language]}</span>
                <span
                  aria-label={`${tierPoints} puan`}
                  className={cn("inline-flex items-center gap-1", style.text)}
                  title={`${tierPoints} puan`}
                >
                  <Coins className="size-3.5" aria-hidden="true" />
                  <span>{tierPoints}</span>
                </span>
              </div>
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
            "absolute inset-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]",
            compact ? "p-2" : "p-2.5",
          )}
        >
          <div
            data-card-back-tier={visibleBackTier}
            className={cn(
              "relative flex h-full overflow-hidden rounded-md border bg-gradient-to-br p-4 text-white",
              style.backPanel,
              style.backBorder,
            )}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-35"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, rgba(255,255,255,0.42) 1px, transparent 1px), linear-gradient(45deg, rgba(255,255,255,0.20) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
              }}
            />
            <PlayingCardBackPattern />

            <div className="relative flex flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-semibold text-white/75">
                  {TIER_LABELS[visibleBackTier]}
                </span>
                <span className="text-xs font-semibold text-white/75">
                  {LANGUAGE_NAMES[card.language]}
                </span>
              </div>

              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div
                  data-card-back-medallion="true"
                  className="relative flex size-24 items-center justify-center rounded-full border border-white/80 bg-white shadow-sm"
                >
                  <span className={cn("font-display text-5xl font-semibold leading-none", style.backText)}>
                    {visibleBackTier}
                  </span>
                  <span className={cn("pointer-events-none absolute inset-2 rounded-full border", style.border)} aria-hidden="true" />
                </div>
                <p className="mt-4 text-sm font-semibold text-white/95">Çevirmek için tıkla</p>
              </div>

              <div className="flex items-end justify-between gap-3 text-xs font-semibold text-white/75">
                <span>Kartlarla Dil</span>
                <span>Koleksiyon</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDetails ? <CardDetailsDialog card={card} open={detailsOpen} onOpenChange={setDetailsOpen} /> : null}
    </article>
  );
}

function PlayingCardBackPattern() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 240 320"
      className="pointer-events-none absolute inset-0 h-full w-full text-white/70"
      fill="none"
    >
      <g stroke="currentColor" strokeWidth="1.4">
        <path d="M120 34 206 160 120 286 34 160Z" opacity="0.58" />
        <path d="M120 58 184 160 120 262 56 160Z" opacity="0.5" />
        <path d="M120 82 162 160 120 238 78 160Z" opacity="0.42" />
        <circle cx="120" cy="160" r="68" opacity="0.36" />
        <circle cx="120" cy="160" r="48" opacity="0.34" />
      </g>
      <g stroke="currentColor" strokeWidth="1.2" opacity="0.52">
        <path d="M38 46c28 10 44 27 48 52" />
        <path d="M202 46c-28 10-44 27-48 52" />
        <path d="M38 274c28-10 44-27 48-52" />
        <path d="M202 274c-28-10-44-27-48-52" />
        <path d="M72 38c5 24 21 38 48 42 27-4 43-18 48-42" />
        <path d="M72 282c5-24 21-38 48-42 27 4 43 18 48 42" />
      </g>
      <g fill="currentColor" opacity="0.32">
        <circle cx="48" cy="58" r="4" />
        <circle cx="192" cy="58" r="4" />
        <circle cx="48" cy="262" r="4" />
        <circle cx="192" cy="262" r="4" />
        <path d="M120 102 128 116 120 130 112 116Z" />
        <path d="M120 190 128 204 120 218 112 204Z" />
      </g>
    </svg>
  );
}

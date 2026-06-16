"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Check, Coins, Info, Plus, Volume2, X } from "lucide-react";
import { TIER_REQUIREMENTS, TIER_STYLES } from "@/data/tiers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CardDetailsDialog } from "@/features/cards/components/card-details-dialog";
import { getCardTranslation } from "@/features/cards/card-localization";
import { speakCardTerm } from "@/features/cards/card-speech";
import { getPointsForTier } from "@/features/progress/progress-stats";
import { getLanguageDisplayName, getPartOfSpeechLabel, getTierLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import type { InventoryCard, Tier, VocabularyCard } from "@/types/domain";

type CardFace = "front" | "back";

interface VocabularyCardViewProps {
  card: VocabularyCard;
  inventory?: InventoryCard;
  owned?: boolean;
  compact?: boolean;
  initialFace?: CardFace;
  face?: CardFace;
  flippable?: boolean;
  backDisplayTier?: Tier;
  className?: string;
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
  face,
  flippable = false,
  backDisplayTier,
  className,
  onAdd,
  onSkip,
}: VocabularyCardViewProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [faceState, setFaceState] = useState<CardFaceState>(() => ({
    cardId: card.id,
    initialFace,
    isFaceUp: initialFace === "front",
  }));
  const { locale } = useLocale();
  const t = useT();
  const style = TIER_STYLES[card.tier];
  const requirement = TIER_REQUIREMENTS[card.tier];
  const tierPoints = getPointsForTier(card.tier);
  const progress = inventory ? Math.min(100, (inventory.correctCount / requirement) * 100) : 0;
  const learned = inventory?.status === "learned";
  const showDetails = !compact;
  const examplePreview = card.examples[0]?.sentence ?? card.example;
  const visibleBackTier = backDisplayTier ?? card.tier;
  const cardTranslation = getCardTranslation(card, locale);
  const isControlled = face !== undefined;
  const isFaceUp = isControlled
    ? face === "front"
    : faceState.cardId === card.id && faceState.initialFace === initialFace
      ? faceState.isFaceUp
      : initialFace === "front";

  function revealFront() {
    if (!isControlled && flippable && !isFaceUp) {
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

  function handleSpeakClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    speakCardTerm(card.term, card.language);
  }

  const flipRoleProps =
    !isControlled && flippable && !isFaceUp
      ? {
          role: "button",
          tabIndex: 0,
          "aria-label": `${card.term}: ${t("cards.flip")}`,
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
        compact ? "" : "min-h-[320px] max-sm:min-h-0",
        flippable && !isFaceUp && "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
        className,
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
            compact ? "p-2 sm:p-3 xl:p-4" : "p-2.5 sm:p-4",
            style.border,
            style.surface,
          )}
        >
          <div className={cn("pointer-events-none absolute h-px bg-slate-900/10", compact ? "inset-x-2 top-10 sm:inset-x-3 sm:top-12 xl:inset-x-4 xl:top-14" : "inset-x-4 top-14 max-sm:inset-x-2.5 max-sm:top-9")} />
          <div className={cn("pointer-events-none absolute h-px bg-slate-900/10", compact ? "inset-x-2 bottom-12 sm:inset-x-3 sm:bottom-14 xl:inset-x-4 xl:bottom-20" : "inset-x-4 bottom-20 max-sm:inset-x-2.5 max-sm:bottom-12")} />

          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge className={cn("border-transparent bg-white/80 max-sm:text-[10px]", style.text)}>
                {card.tier} · {getTierLabel(card.tier, locale)}
              </Badge>
              <div className="mt-3 flex translate-y-1 items-center gap-2 text-xs font-semibold text-slate-500 max-sm:mt-1 max-sm:text-[10px]">
                <span>{getLanguageDisplayName(card.language, locale)}</span>
                <span
                  aria-label={`${tierPoints} ${t("common.points")}`}
                  className={cn("inline-flex items-center gap-1", style.text)}
                  title={`${tierPoints} ${t("common.points")}`}
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
                  aria-label={`${card.term} ${t("cards.details")}`}
                  title={t("cards.details")}
                  onClick={handleDetailsClick}
                  className="size-9 border-white/70 bg-white/80 max-sm:size-7"
                >
                  <Info className="size-4" aria-hidden="true" />
                </Button>
              ) : null}
              <span className={cn("size-3 rounded-full max-sm:size-2.5", style.accent)} aria-hidden="true" />
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center py-6 max-sm:flex-initial max-sm:justify-start max-sm:py-1">
            <div className="flex items-center gap-2 text-slate-500">
              <button
                type="button"
                aria-label={`${card.term} ${t("cards.speak")}`}
                title={t("cards.speak")}
                onClick={handleSpeakClick}
                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 max-sm:size-6"
              >
                <Volume2 className="size-4 max-sm:size-3" aria-hidden="true" />
              </button>
              <span className="text-sm max-sm:text-xs">{card.pronunciation}</span>
            </div>
            <h3
              className={cn(
                "mt-3 font-display font-semibold leading-none text-slate-950 max-sm:mt-1",
                compact ? "text-xl sm:text-2xl xl:text-3xl" : "text-2xl sm:text-4xl",
              )}
            >
              {card.term}
            </h3>
            <p className="mt-3 text-sm font-semibold text-slate-500 max-sm:mt-1 max-sm:text-[10px]">{getPartOfSpeechLabel(card.termKind, locale)}</p>
            {!compact ? <p className="mt-5 text-lg font-semibold text-slate-800 max-sm:mt-1 max-sm:text-xs max-sm:leading-tight">{cardTranslation}</p> : null}
          </div>

          {!compact ? (
            <p className="truncate text-sm leading-6 text-slate-700 max-sm:mt-1 max-sm:text-xs max-sm:leading-4" title={examplePreview}>
              {examplePreview}
            </p>
          ) : null}

          {inventory ? (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>{learned ? t("cards.learned") : t("cards.progress")}</span>
                <span>
                  {inventory.correctCount}/{requirement}
                </span>
              </div>
              <Progress value={progress} indicatorClassName={style.accent} />
            </div>
          ) : null}

          {onAdd || onSkip ? (
            <div className="mt-4 grid grid-cols-2 gap-2 max-sm:mt-2 max-sm:gap-1.5">
              <Button variant="secondary" onClick={handleSkipClick} disabled={!onSkip} className="h-8 px-2 text-xs max-sm:h-7 max-sm:px-1 max-sm:text-[10px]">
                <X className="size-3" aria-hidden="true" />
                {t("cards.skip")}
              </Button>
              <Button onClick={handleAddClick} disabled={owned || !onAdd} className="h-8 px-2 text-xs max-sm:h-7 max-sm:px-1 max-sm:text-[10px]">
                {owned ? <Check className="size-3" aria-hidden="true" /> : <Plus className="size-3" aria-hidden="true" />}
                {owned ? t("cards.owned") : t("cards.add")}
              </Button>
            </div>
          ) : null}
        </div>

        <div
          aria-hidden={isFaceUp}
          inert={isFaceUp}
          className={cn(
            "absolute inset-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]",
            compact ? "p-2" : "p-1.5 sm:p-2.5",
          )}
        >
          <div
            data-card-back-tier={visibleBackTier}
            className={cn(
              "relative flex h-full overflow-hidden rounded-md border bg-gradient-to-br p-4 text-white max-sm:p-2.5",
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
                <span className="text-xs font-semibold text-white/75 max-sm:text-[10px]">{getTierLabel(visibleBackTier, locale)}</span>
                <span className="text-xs font-semibold text-white/75 max-sm:text-[10px]">{getLanguageDisplayName(card.language, locale)}</span>
              </div>

              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div
                  data-card-back-medallion="true"
                  className="relative flex size-24 items-center justify-center rounded-full border border-white/80 bg-white shadow-sm max-sm:size-16"
                >
                  <span className={cn("font-display text-5xl font-semibold leading-none max-sm:text-3xl", style.backText)}>
                    {visibleBackTier}
                  </span>
                  <span className={cn("pointer-events-none absolute inset-2 rounded-full border max-sm:inset-1", style.border)} aria-hidden="true" />
                </div>
                <p className="mt-4 text-sm font-semibold text-white/95 max-sm:mt-2 max-sm:text-xs">{t("cards.flip")}</p>
              </div>

              <div className="flex items-end justify-between gap-3 text-xs font-semibold text-white/75 max-sm:text-[10px]">
                <span>FoxiesDeck</span>
                <span>{t("cards.collection")}</span>
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

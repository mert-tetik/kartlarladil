"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Coins, Info, MessageCircleQuestion, Plus, Volume2, X } from "lucide-react";
import { TIER_REQUIREMENTS, TIER_STYLES } from "@/data/tiers";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import { CardDetailsDialog } from "@/features/cards/components/card-details-dialog";
import { getCardTranslation } from "@/features/cards/card-localization";
import { speakCardTerm } from "@/features/cards/card-speech";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { getPointsForTier } from "@/features/progress/progress-stats";
import { getLanguageDisplayName, getPartOfSpeechLabel, getTierLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import type { InventoryCard, Tier, VocabularyCard } from "@/types/domain";

type CardFace = "front" | "back";

interface VocabularyCardViewProps {
  card: VocabularyCard;
  inventory?: InventoryCard;
  owned?: boolean;
  allowOwnedAdd?: boolean;
  initialFace?: CardFace;
  face?: CardFace;
  flippable?: boolean;
  backDisplayTier?: Tier;
  className?: string;
  onAdd?: () => void;
  onSkip?: () => void;
  showActions?: boolean;
  frontFit?: boolean;
  frontMinimal?: boolean;
  onClick?: () => void;
}

interface CardFaceState {
  cardId: string;
  initialFace: CardFace;
  isFaceUp: boolean;
}

const ADD_BUTTON_TEXT_BY_TIER: Record<Tier, string> = {
  A1: "text-emerald-800",
  A2: "text-sky-800",
  B1: "text-violet-800",
  B2: "text-amber-800",
  C1: "text-rose-800",
};

export function VocabularyCardView({
  card,
  inventory,
  owned,
  allowOwnedAdd = false,
  initialFace = "front",
  face,
  flippable = false,
  backDisplayTier,
  className,
  onAdd,
  onSkip,
  showActions = true,
  frontFit = false,
  frontMinimal = false,
  onClick,
}: VocabularyCardViewProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [faceState, setFaceState] = useState<CardFaceState>(() => ({
    cardId: card.id,
    initialFace,
    isFaceUp: initialFace === "front",
  }));

  const t = useT();

  const isControlled = face !== undefined;
  const isFaceUp = isControlled
    ? face === "front"
    : faceState.cardId === card.id && faceState.initialFace === initialFace
      ? faceState.isFaceUp
      : initialFace === "front";

  function revealFront() {
    if (!isControlled && flippable && !isFaceUp) {
      vibrate("flip");
      setFaceState({ cardId: card.id, initialFace, isFaceUp: true });
    }
  }

  function openDetails() {
    if (!isControlled && flippable && isFaceUp) {
      setDetailsOpen(true);
    }
  }

  function handleCardClick() {
    if (isControlled) {
      onClick?.();
      return;
    }

    if (!flippable) {
      return;
    }

    if (!isFaceUp) {
      revealFront();
    } else {
      openDetails();
    }
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!flippable || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();

    if (!isFaceUp) {
      revealFront();
    } else {
      openDetails();
    }
  }

  const flipRoleProps =
    !isControlled && flippable && !isFaceUp
      ? {
          role: "button",
          tabIndex: 0,
          "aria-label": `${card.term}: ${t("cards.flip")}`,
          "aria-pressed": false,
          onKeyDown: handleCardKeyDown,
        }
      : {};

  return (
    <article
      data-card-face={isFaceUp ? "front" : "back"}
      data-theme="default"
      {...flipRoleProps}
      onClick={handleCardClick}
      className={cn(
        "group relative aspect-[3/4] min-w-0 rounded-lg [perspective:1200px]",
        "min-h-[320px] max-sm:aspect-auto max-sm:min-h-[280px]",
        flippable && !isFaceUp && "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        className,
      )}
    >
      <div
        className={cn(
          "relative h-full min-h-[inherit] w-full transition-transform duration-250 ease-out [transform-style:preserve-3d] motion-reduce:transition-none",
          isFaceUp ? "[transform:rotateY(0deg)]" : "[transform:rotateY(180deg)]",
        )}
      >
        <CardFront
          card={card}
          inventory={inventory}
          owned={owned}
          allowOwnedAdd={allowOwnedAdd}
          isFaceUp={isFaceUp}
          onShowDetails={() => setDetailsOpen(true)}
          onAdd={onAdd}
          onSkip={onSkip}
          showActions={showActions}
          frontFit={frontFit}
          frontMinimal={frontMinimal}
        />
        <CardBack card={card} isFaceUp={isFaceUp} backDisplayTier={backDisplayTier} />
      </div>

      <CardDetailsDialog card={card} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </article>
  );
}

function CardFront({
  card,
  inventory,
  owned,
  allowOwnedAdd = false,
  isFaceUp,
  onShowDetails,
  onAdd,
  onSkip,
  showActions = true,
  frontFit = false,
  frontMinimal = false,
}: {
  card: VocabularyCard;
  inventory?: InventoryCard;
  owned?: boolean;
  allowOwnedAdd?: boolean;
  isFaceUp: boolean;
  onShowDetails: () => void;
  onAdd?: () => void;
  onSkip?: () => void;
  showActions?: boolean;
  frontFit?: boolean;
  frontMinimal?: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const router = useRouter();
  const requireAuth = useRequireAuthAction();
  const style = TIER_STYLES[card.tier];
  const requirement = TIER_REQUIREMENTS[card.tier];
  const tierPoints = getPointsForTier(card.tier);
  const progress = inventory ? Math.min(100, (inventory.correctCount / requirement) * 100) : 0;
  const learned = inventory?.status === "learned";
  const showOwnedState = owned && !allowOwnedAdd;
  const examplePreview = card.examples[0]?.sentence ?? card.example;
  const cardTranslation = getCardTranslation(card, locale);

  function handleDetailsClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onShowDetails();
  }

  function handleSkipClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onSkip?.();
  }

  function handleAddClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onAdd?.();
  }

  function handleAskClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const askPath = `/ask/${card.language}?term=${encodeURIComponent(card.term)}`;
    requireAuth(() => router.push(askPath), { nextPath: askPath });
  }

  function handleSpeakClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    speakCardTerm(card.term, card.language);
  }

  return (
    <div
      aria-hidden={!isFaceUp}
      inert={!isFaceUp}
      className={cn(
        "absolute inset-0 flex flex-col overflow-hidden rounded-lg border bg-background-card [backface-visibility:hidden]",
        "p-2.5 sm:p-4",
        frontFit ? "justify-between" : "max-sm:justify-between",
        "dark:text-white",
        style.border,
      )}
    >
      <div
        className={cn(
          "-mx-2.5 -mt-2.5 flex items-center justify-between gap-2 px-3 py-2 text-white sm:-mx-4 sm:-mt-4 sm:px-4 sm:py-3",
          style.accent,
        )}
      >
        {!frontMinimal ? (
          <span className="text-sm font-bold sm:text-base">
            {card.tier} · {getTierLabel(card.tier, locale)}
          </span>
        ) : null}
        {showActions && !frontMinimal ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={`${card.term} ${t("cards.details")}`}
              title={t("cards.details")}
              onClick={handleDetailsClick}
              className="size-7 border-0 bg-white/20 text-white hover:bg-white/30 sm:size-8"
            >
              <Info className="size-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={`${card.term} ${t("cards.ask")}`}
              title={t("cards.ask")}
              onClick={handleAskClick}
              className="size-7 border-0 bg-white/20 text-white hover:bg-white/30 sm:size-8"
            >
              <MessageCircleQuestion className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col justify-center py-4 text-center max-sm:py-2">
        <div className="mb-2 flex items-center justify-center gap-2 text-xs font-semibold text-foreground-muted dark:text-white/70 max-sm:text-[10px]">
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

        <div className="flex items-center justify-center gap-2 text-foreground-muted">
          <button
            type="button"
            aria-label={`${card.term} ${t("cards.speak")}`}
            title={t("cards.speak")}
            onClick={handleSpeakClick}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:text-white dark:hover:bg-white/20 dark:hover:text-white max-sm:size-6"
          >
            <Volume2 className="size-4 max-sm:size-3" aria-hidden="true" />
          </button>
          <span className="text-sm text-foreground-muted dark:text-white/80 max-sm:text-xs">{card.pronunciation}</span>
        </div>
        <h3 className="mt-3 font-display text-2xl font-semibold leading-none text-foreground dark:text-white max-sm:mt-1 sm:text-4xl">
          {card.term}
        </h3>
        <p className="mt-3 text-sm font-semibold text-foreground-muted dark:text-white/70 max-sm:mt-1 max-sm:text-[10px]">
          {getPartOfSpeechLabel(card.termKind, locale)}
        </p>
        <div
          className={cn(
            "flex items-start justify-center",
            frontMinimal ? "min-h-0" : "mt-5 max-sm:mt-1",
            frontFit ? "min-h-0" : frontMinimal ? "min-h-0" : "h-12 max-sm:h-8",
          )}
        >
          <p
            className={cn(
              "text-lg font-semibold leading-6 text-foreground dark:text-white max-sm:text-xs max-sm:leading-tight",
              frontFit ? "line-clamp-3" : "line-clamp-2",
            )}
          >
            {cardTranslation}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "-mx-2.5 -mb-2.5 space-y-2 px-3 py-2 text-white sm:-mx-4 sm:-mb-4 sm:px-4 sm:py-3",
          style.accent,
        )}
      >
        {!frontMinimal ? (
          <p
            className={cn(
              "text-sm font-medium leading-5 max-sm:text-xs",
              frontFit ? "line-clamp-2" : "truncate",
            )}
            title={examplePreview}
          >
            {examplePreview}
          </p>
        ) : null}

        {inventory && !frontMinimal ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>{learned ? t("cards.learned") : t("cards.progress")}</span>
              <span>
                {inventory.correctCount}/{requirement}
              </span>
            </div>
            <Progress value={progress} className="bg-white/30" indicatorClassName="bg-white" />
          </div>
        ) : null}

        {!frontMinimal && (onAdd || onSkip) ? (
          <div className="grid grid-cols-2 gap-2 max-sm:gap-1.5">
            <Button
              variant="secondary"
              onClick={handleSkipClick}
              disabled={!onSkip}
              className="h-8 border-0 bg-rose-500 px-2 text-xs text-white hover:bg-rose-600 max-sm:h-7 max-sm:px-1 max-sm:text-[10px]"
            >
              <X className="size-3" aria-hidden="true" />
              {t("cards.skip")}
            </Button>
            <Button
              onClick={handleAddClick}
              disabled={!onAdd || showOwnedState}
              data-tutorial-target="card-add"
              className={cn(
                "h-8 bg-white px-2 text-xs hover:bg-white/90 max-sm:h-7 max-sm:px-1 max-sm:text-[10px]",
                ADD_BUTTON_TEXT_BY_TIER[card.tier],
              )}
            >
              {showOwnedState ? <Check className="size-3" aria-hidden="true" /> : <Plus className="size-3" aria-hidden="true" />}
              {showOwnedState ? t("cards.owned") : t("cards.add")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CardBack({
  card,
  isFaceUp,
  backDisplayTier,
}: {
  card: VocabularyCard;
  isFaceUp: boolean;
  backDisplayTier?: Tier;
}) {
  const { locale } = useLocale();
  const t = useT();
  const style = TIER_STYLES[card.tier];
  const visibleBackTier = backDisplayTier ?? card.tier;

  return (
    <div
      aria-hidden={isFaceUp}
      inert={isFaceUp}
      className={cn(
        "absolute inset-0 overflow-hidden rounded-lg border border-border bg-background-card shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]",
        "p-1.5 sm:p-2.5",
      )}
    >
      <div
        data-card-back-tier={visibleBackTier}
        className={cn(
          "relative flex h-full overflow-hidden rounded-md border bg-gradient-to-br p-4 text-foreground-inverse max-sm:p-2.5",
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
            <span className="text-xs font-semibold text-foreground-inverse/75 max-sm:text-[10px]">{getTierLabel(visibleBackTier, locale)}</span>
            <span className="text-xs font-semibold text-foreground-inverse/75 max-sm:text-[10px]">{getLanguageDisplayName(card.language, locale)}</span>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div data-card-back-medallion="true" className="relative flex size-24 items-center justify-center rounded-full border border-foreground-inverse/80 bg-background-card shadow-sm max-sm:size-16">
              <span className={cn("font-display text-5xl font-semibold leading-none max-sm:text-3xl", style.backText)}>
                {visibleBackTier}
              </span>
              <span className={cn("pointer-events-none absolute inset-2 rounded-full border max-sm:inset-1", style.border)} aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground-inverse/95 max-sm:mt-2 max-sm:text-xs">{t("cards.flip")}</p>
          </div>

          <div className="flex items-end justify-between gap-3 text-xs font-semibold text-foreground-inverse/75 max-sm:text-[10px]">
            <span>FoxiesDeck</span>
            <span>{t("cards.collection")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayingCardBackPattern() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 240 320"
      className="pointer-events-none absolute inset-0 h-full w-full text-foreground-inverse/70"
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

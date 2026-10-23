"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Check, LoaderCircle, MessageCircleQuestion, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIER_REQUIREMENTS } from "@/data/tiers";
import { getCardTranslation, getCardTranslationMeanings, getPrimaryCardTranslation } from "@/features/cards/card-localization";
import { speakCardTerm } from "@/features/cards/card-speech";
import { VocabularyCardDesign } from "@/features/cards/components/card-design-reference-preview";
import { useCardPronunciation } from "@/features/cards/card-pronunciation-client";
import { useAskOverlay } from "@/features/ask/components/ask-overlay-provider";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { getCardDesignTierPalette } from "@/features/cards/card-design-tier-palette";
import { useLocale, useT } from "@/i18n/locale-provider";
import { vibrate } from "@/lib/vibration";
import { cn } from "@/lib/utils";
import type { InventoryCard, LocaleCode, Tier, VocabularyCard } from "@/types/domain";

type CardFace = "front" | "back";
type CardFooterMode = "auto" | "empty" | "progress";

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
  addLabel?: string;
  ownedLabel?: string;
  addLoading?: boolean;
  addLoadingLabel?: string;
  addDisabled?: boolean;
  onSkip?: () => void;
  showActions?: boolean;
  frontFit?: boolean;
  frontMinimal?: boolean;
  frontContentScale?: number;
  frontTranslationBelowTerm?: boolean;
  frontHideStudyMetadata?: boolean;
  frontFitCoreText?: boolean;
  compact?: boolean;
  translationLocale?: LocaleCode;
  primaryTranslationOnly?: boolean;
  continuousFlip?: boolean;
  footerMode?: CardFooterMode;
  footerProgressCount?: number;
  progressAnimationActive?: boolean;
  onClick?: () => void;
  staticFace?: boolean;
  summaryCard?: boolean;
  summaryProgressCount?: number;
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
  allowOwnedAdd = false,
  initialFace = "front",
  face,
  flippable = false,
  backDisplayTier,
  className,
  onAdd,
  addLabel,
  ownedLabel,
  addLoading = false,
  addLoadingLabel,
  addDisabled = false,
  onSkip,
  showActions = true,
  frontMinimal = false,
  frontContentScale = 1,
  frontHideStudyMetadata = false,
  compact = false,
  translationLocale,
  primaryTranslationOnly = false,
  continuousFlip = false,
  footerMode = "auto",
  footerProgressCount,
  progressAnimationActive = false,
  onClick,
  staticFace = false,
  summaryProgressCount,
}: VocabularyCardViewProps) {
  const { locale } = useLocale();
  const t = useT();
  const { openAsk } = useAskOverlay();
  const requireAuth = useRequireAuthAction();
  const { pronunciation: resolvedPronunciation } = useCardPronunciation(card);
  const displayCard = resolvedPronunciation ? { ...card, pronunciation: resolvedPronunciation } : card;
  const [faceState, setFaceState] = useState<CardFaceState>(() => ({
    cardId: card.id,
    initialFace,
    isFaceUp: initialFace === "front",
  }));

  const isControlled = face !== undefined || staticFace;
  const isFaceUp = staticFace
    ? true
    : face !== undefined
      ? face === "front"
      : faceState.cardId === card.id && faceState.initialFace === initialFace
        ? faceState.isFaceUp
        : initialFace === "front";
  const translationLanguage = translationLocale ?? locale;
  const meanings = primaryTranslationOnly
    ? [getPrimaryCardTranslation(displayCard, translationLanguage)]
    : translationLocale
      ? getCardTranslationMeanings(displayCard, translationLanguage).slice(0, 3)
      : getCardTranslation(displayCard, translationLanguage).split(", ");
  const sample = {
    cardId: card.id,
    learningLanguage: card.language,
    nativeLanguage: translationLanguage,
    tier: card.tier,
    term: card.term,
    translation: meanings.filter(Boolean).join(", "),
    partOfSpeech: card.partOfSpeech,
    pronunciation: frontHideStudyMetadata || compact && summaryProgressCount !== undefined
      ? ""
      : displayCard.pronunciation,
    example: frontHideStudyMetadata || footerMode === "empty"
      ? ""
      : card.examples[0]?.sentence ?? card.example,
  };
  const requirement = TIER_REQUIREMENTS[card.tier];
  const progressCount = footerProgressCount ?? summaryProgressCount ?? inventory?.correctCount ?? 0;
  const progress = inventory?.status === "learned"
    ? requirement
    : Math.min(requirement, Math.max(0, progressCount));
  const showProgress = (inventory !== undefined && footerMode !== "empty")
    || footerProgressCount !== undefined
    || summaryProgressCount !== undefined;
  const showOwnedState = owned === true && !allowOwnedAdd;
  const palette = getCardDesignTierPalette(card.tier);

  function revealFront() {
    if (!isControlled && flippable && !isFaceUp) {
      vibrate("flip");
      setFaceState({ cardId: card.id, initialFace, isFaceUp: true });
    }
  }

  function handleCardClick() {
    if (isControlled) {
      onClick?.();
      return;
    }
    if (!flippable) return;
    if (!isFaceUp) revealFront();
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!flippable || isControlled || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    if (!isFaceUp) revealFront();
  }

  function handleAskClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const askPath = `/ask/${card.language}?term=${encodeURIComponent(card.term)}`;
    requireAuth(() => openAsk({ contextLanguage: card.language, initialTerm: card.term }), { nextPath: askPath });
  }

  function handleAddClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onAdd?.();
  }

  function handleSkipClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onSkip?.();
  }

  const flipRoleProps = !isControlled && flippable && !isFaceUp
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": `${card.term}: ${t("cards.flip")}`,
        "aria-pressed": false,
        onKeyDown: handleCardKeyDown,
      }
    : {};

  return (
    <article
      aria-label={card.term}
      data-card-face={isFaceUp ? "front" : "back"}
      data-theme="default"
      {...flipRoleProps}
      onClick={handleCardClick}
      className={cn(
        "group relative aspect-[3/4] min-w-0 rounded-lg [perspective:1200px]",
        "min-h-[320px] max-sm:aspect-[3/4] max-sm:min-h-[280px]",
        flippable && !isFaceUp && "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        compact && "min-h-0 max-sm:min-h-0",
        className,
      )}
    >
      <VocabularyCardDesign
        backDisplayTier={backDisplayTier}
        className="h-full w-full"
        continuousFlip={continuousFlip}
        contentScale={frontContentScale}
        onSpeak={() => speakCardTerm(card.term, card.language)}
        sample={sample}
        showExample={!frontMinimal && !frontHideStudyMetadata && footerMode !== "empty"}
        showBack={!isFaceUp}
        showPronunciation={!frontMinimal && !frontHideStudyMetadata}
        learningProgress={isFaceUp && showProgress ? {
          current: progress,
          required: requirement,
          progressLabel: t("cards.progress"),
          isLearned: inventory?.status === "learned",
          animationActive: progressAnimationActive,
          footerMode,
        } : undefined}
      />

      {isFaceUp && showActions && !frontMinimal ? (
        <Button
          aria-label={`${card.term} ${t("cards.ask")}`}
          className="absolute right-[7%] top-[5%] z-10 size-8 rounded-full border border-white/70 bg-black/15 p-0 text-white backdrop-blur-sm hover:bg-black/25"
          onClick={handleAskClick}
          title={t("cards.ask")}
          type="button"
          variant="secondary"
          size="icon"
        >
          <MessageCircleQuestion className="size-4" aria-hidden="true" />
        </Button>
      ) : null}

      {isFaceUp && !compact && !frontMinimal && !frontHideStudyMetadata && (onAdd || onSkip) ? (
        <div
          className={cn("absolute inset-x-[11%] bottom-[2%] z-20 grid gap-1.5", onAdd && onSkip ? "grid-cols-2" : "grid-cols-1")}
          data-card-footer-mode={footerMode}
        >
          {onSkip ? (
            <Button
              onClick={handleSkipClick}
              className="h-7 min-w-0 border border-white/80 bg-rose-500/95 px-1.5 text-[10px] text-white hover:bg-rose-600"
              type="button"
              variant="secondary"
            >
              <X className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{t("cards.skip")}</span>
            </Button>
          ) : null}
          {onAdd ? (
            <Button
              type="button"
              onClick={handleAddClick}
              disabled={showOwnedState || addLoading || addDisabled}
              data-tutorial-target="card-add"
              className="h-7 min-w-0 border border-white/80 bg-white/95 px-1.5 text-[10px] hover:bg-white"
              style={{ color: palette.label }}
            >
              {addLoading
                ? <LoaderCircle className="size-3 shrink-0 animate-spin" aria-hidden="true" />
                : showOwnedState
                  ? <Check className="size-3 shrink-0" aria-hidden="true" />
                  : <Plus className="size-3 shrink-0" aria-hidden="true" />}
              <span className="truncate">
                {showOwnedState
                  ? ownedLabel ?? t("cards.owned")
                  : addLoading
                    ? addLoadingLabel ?? t("common.loading")
                    : addLabel ?? t("cards.add")}
              </span>
            </Button>
          ) : null}
        </div>
      ) : null}

    </article>
  );
}

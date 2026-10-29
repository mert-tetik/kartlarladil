"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, ScanText } from "lucide-react";
import { MobileCardPodiumOverlay } from "@/app/components/mobile-card-podium-overlay";
import { MobileEmptyDeckPointer } from "@/app/components/mobile-empty-deck-pointer";
import { MobileCardStatusArtwork } from "@/app/components/mobile-card-status-artwork";
import { LanguageFlag } from "@/components/language-flag";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { InventoryCardView } from "@/features/inventory/inventory-selectors";
import type { LanguageCode } from "@/types/domain";

type CardStatusFilter = "all" | "active" | "learned";

export function MobileLandingCardCenter({
  activeCards,
  learnedCards,
  selectedLanguage,
  status,
  isOpen,
  onStatusChange,
  onOpenChange,
  onOpenDraw,
  onOpenImageTranslate,
  onOpenCreate,
  onOpenGroups,
  showEmptyDeckPointer,
}: {
  activeCards: InventoryCardView[];
  learnedCards: InventoryCardView[];
  selectedLanguage: LanguageCode;
  status: CardStatusFilter;
  isOpen: boolean;
  onStatusChange: (status: CardStatusFilter) => void;
  onOpenChange: (isOpen: boolean) => void;
  onOpenDraw: () => void;
  onOpenImageTranslate: () => void;
  onOpenCreate: () => void;
  onOpenGroups: () => void;
  showEmptyDeckPointer: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [podiumMode, setPodiumMode] = useState<"collection" | "review">("collection");
  const drawActionRef = useRef<HTMLDivElement>(null);
  const cards = useMemo(
    () => {
      const sourceCards = status === "active" ? activeCards : status === "learned" ? learnedCards : [...activeCards, ...learnedCards];
      // Keep the optimistic and cloud-backed views in the same newest-first order.
      return sourceCards
        .sort((left, right) => Date.parse(right.inventory.addedAt) - Date.parse(left.inventory.addedAt));
    },
    [activeCards, learnedCards, status],
  );
  const statusLabel = t(`cards.${status === "all" ? "all" : status === "active" ? "toLearn" : "learned"}`);

  function handleToggle() {
    onOpenChange(!isOpen);
  }

  function openReviewMode() {
    const firstCard = activeCards[0]?.card;
    if (!firstCard) return;

    setPodiumMode("review");
    setSelectedCardId(firstCard.id);
  }

  return (
    <section
      data-mobile-card-center
      data-route-transition-surface
      className="mt-3 pb-3"
      aria-label={t("cards.centerTitle")}
    >
      <div className="relative h-14 w-full">
        <button type="button" onClick={handleToggle} aria-expanded={isOpen} aria-controls="mobile-card-center-content" data-tutorial-target="landing-card-center" className="flex h-14 w-full items-center justify-start gap-2 rounded-xl border border-black/10 bg-white px-4 pr-36 text-base font-semibold text-black transition-colors hover:bg-slate-100 active:scale-[0.98]">
          <span>{t("cards.centerTitle")}</span>
          <ChevronDown className={cn("size-5 transition-transform duration-300", isOpen && "rotate-180")} aria-hidden="true" />
        </button>
        <div className="absolute inset-y-0 right-2 z-50 flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenImageTranslate}
            aria-label={t("imageTranslate.open")}
            data-tutorial-target="landing-image-translate"
            className="inline-flex size-10 items-center justify-center text-black transition-transform active:scale-[0.92]"
          >
            <ScanText className="size-6" strokeWidth={2.5} aria-hidden="true" />
          </button>
          <div ref={drawActionRef} className="relative">
            <button type="button" onClick={onOpenDraw} aria-label={t("nav.cardDraw")} data-tutorial-target="landing-draw-cards" className="inline-flex size-10 items-center justify-center transition-transform active:scale-[0.92]">
              <Image src="/card-icons/draw_cards_button.png" alt="" width={40} height={40} className="size-10 translate-y-0.5 object-contain" aria-hidden="true" />
            </button>
            <MobileEmptyDeckPointer enabled={showEmptyDeckPointer} anchorRef={drawActionRef} />
          </div>
          <button type="button" onClick={onOpenCreate} aria-label={t("cards.createCustom")} data-tutorial-target="landing-create-card" className="inline-flex size-10 items-center justify-center transition-transform active:scale-[0.92]">
            <Image src="/card-icons/add_custom_card_button.png" alt="" width={40} height={40} className="size-10 object-contain" aria-hidden="true" />
          </button>
          <button type="button" onClick={onOpenGroups} aria-label={t("cards.groups.title")} data-tutorial-target="landing-card-groups" className="inline-flex size-10 items-center justify-center transition-transform active:scale-[0.92]">
            <Image src="/card-icons/add_cards_with_groups.png" alt="" width={40} height={40} className="size-10 object-contain" aria-hidden="true" />
          </button>
        </div>
      </div>

      {isOpen ? (
        <div id="mobile-card-center-content" className="animate-screen-pop">
          <div
            data-mobile-card-filters
            className="sticky top-[-0.875rem] z-40 -mx-4 space-y-2 border-b border-border bg-background px-4 py-3 shadow-sm"
          >
              <div className="grid grid-cols-[0.8fr_1.1fr_1.1fr] gap-1 rounded-lg bg-background-muted p-1">
                {(["all", "active", "learned"] as const).map((item) => (
                  <button key={item} type="button" onClick={() => onStatusChange(item)} className={cn("inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-semibold transition-all duration-300", status === item ? item === "all" ? "bg-white text-black shadow-sm" : item === "active" ? "bg-action-learn text-white shadow-sm" : "bg-action-learned text-white shadow-sm" : "text-foreground-secondary")}>
                    <span>{t(`cards.${item === "all" ? "all" : item === "active" ? "toLearn" : "learned"}`)}</span>
                    {item !== "all" ? <MobileCardStatusArtwork status={item} active={status === item} className="size-6" /> : null}
                  </button>
                ))}
              </div>
              <div
                className={cn(
                  "flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-white transition-colors duration-300 ease-out font-super-water",
                  status === "all" ? "bg-black" : status === "active" ? "bg-action-learn" : "bg-action-learned",
                )}
              >
                <LanguageFlag code={selectedLanguage} className="size-6" />
                <span className="truncate">{formatSuperWaterText(locale, getLanguageDisplayName(selectedLanguage, locale))}</span>
                <span className="text-white/60" aria-hidden="true">•</span>
                <span className="min-w-0 truncate">{formatSuperWaterText(locale, statusLabel)}</span>
                <button
                  type="button"
                  onClick={openReviewMode}
                  disabled={activeCards.length === 0}
                  aria-label={t("cards.review")}
                  className="ml-auto inline-flex h-8 shrink-0 items-center rounded-full bg-white/95 px-3 text-xs font-semibold leading-none text-black transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                >
                  {formatSuperWaterText(locale, t("cards.review"))}
                </button>
              </div>
          </div>

          <div className="-mx-4 grid grid-cols-3 gap-0 bg-background-card" data-mobile-card-grid>
            {cards.length ? cards.map(({ card, inventory }) => (
              <div
                key={`${card.id}-${String(inventory.status ?? "").trim().toLowerCase()}-${inventory.correctCount}`}
                role="button"
                tabIndex={0}
                aria-label={card.term}
                data-mobile-vocabulary-card
                onClick={(event) => {
                  setPodiumMode("collection");
                  setSelectedCardId(card.id);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setSelectedCardId(card.id);
                }}
              >
                <VocabularyCardView
                  card={card}
                  inventory={inventory}
                  face="front"
                  showActions={false}
                  compact
                  className="aspect-[3/4] min-h-0 w-full rounded-none max-sm:aspect-[3/4] max-sm:min-h-0"
                  pronunciationMatchesTranslation
                  showGroupImage
                />
              </div>
            )) : (
              <p className="col-span-3 px-4 py-10 text-center text-sm text-foreground-secondary">
                {t("home.mobile.noWordsInLanguage", {
                  language: getLanguageDisplayName(selectedLanguage, locale),
                })}
              </p>
            )}
          </div>
        </div>
      ) : null}
      <MobileCardPodiumOverlay
        items={cards}
        reviewActiveItems={activeCards}
        reviewLearnedItems={learnedCards}
        selectedCardId={selectedCardId}
        isOpen={selectedCardId !== null}
        onSelectedCardChange={setSelectedCardId}
        onClose={() => {
          setPodiumMode("collection");
          setSelectedCardId(null);
        }}
        mode={podiumMode}
      />
    </section>
  );
}

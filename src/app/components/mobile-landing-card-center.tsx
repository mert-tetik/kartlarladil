"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, Languages } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { MobileCardDisplaySheet } from "@/app/components/mobile-card-display-sheet";
import { MobileEmptyDeckPointer } from "@/app/components/mobile-empty-deck-pointer";
import { MobileCardStatusArtwork } from "@/app/components/mobile-card-status-artwork";
import { getCardTranslation } from "@/features/cards/card-localization";
import { speakCardTerm, speakText } from "@/features/cards/card-speech";
import { TIER_STYLES, TIERS } from "@/data/tiers";
import { getPointsForTier } from "@/features/progress/progress-stats";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import type { InventoryCardView } from "@/features/inventory/inventory-selectors";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

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
  onOpenCreate: () => void;
  onOpenGroups: () => void;
  showEmptyDeckPointer: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const [tier, setTier] = useState<Tier | "all">("all");
  const [selectedCard, setSelectedCard] = useState<VocabularyCard | null>(null);
  const cards = useMemo(
    () => {
      const sourceCards = status === "active" ? activeCards : status === "learned" ? learnedCards : [...activeCards, ...learnedCards];
      // Keep the optimistic and cloud-backed views in the same newest-first order.
      return sourceCards
        .filter(({ card }) => tier === "all" || card.tier === tier)
        .sort((left, right) => Date.parse(right.inventory.addedAt) - Date.parse(left.inventory.addedAt));
    },
    [activeCards, learnedCards, status, tier],
  );
  const statusLabel = t(`cards.${status === "all" ? "all" : status === "active" ? "toLearn" : "learned"}`);

  function handleToggle() {
    onOpenChange(!isOpen);
  }

  return (
    <section data-mobile-card-center className="mt-3 pb-3" aria-label={t("cards.centerTitle")}>
      <div className="relative h-14 w-full">
        <button type="button" onClick={handleToggle} aria-expanded={isOpen} aria-controls="mobile-card-center-content" data-tutorial-target="landing-card-center" className="flex h-14 w-full items-center justify-start gap-2 rounded-xl border border-black/10 bg-white px-4 pr-36 text-base font-semibold text-black transition-colors hover:bg-slate-100 active:scale-[0.98]">
          <span>{t("cards.centerTitle")}</span>
          <ChevronDown className={cn("size-5 transition-transform duration-300", isOpen && "rotate-180")} aria-hidden="true" />
        </button>
        <div className="absolute inset-y-0 right-2 z-10 flex items-center gap-2">
          <div className="relative">
            <button type="button" onClick={onOpenDraw} aria-label={t("nav.cardDraw")} data-tutorial-target="landing-draw-cards" className="inline-flex size-10 items-center justify-center transition-transform active:scale-[0.92]">
              <Image src="/card-icons/draw_cards_button.png" alt="" width={40} height={40} className="size-10 translate-y-0.5 object-contain" aria-hidden="true" />
            </button>
            <MobileEmptyDeckPointer enabled={showEmptyDeckPointer} />
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
              <div className="grid w-full grid-cols-[1.4fr_repeat(5,minmax(0,1fr))] px-1">
                <FilterChip label={t("home.mobile.allTiers")} selected={tier === "all"} onClick={() => setTier("all")} />
                {TIERS.map((item) => (
                  <FilterChip
                    key={item}
                    label={item}
                    selected={tier === item}
                    onClick={() => setTier(item)}
                    className={TIER_STYLES[item].text}
                    selectedClassName={cn(TIER_STYLES[item].accent, item === "B2" ? "text-black" : "text-white")}
                  />
                ))}
              </div>
              <div
                className={cn(
                  "flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold text-white transition-colors duration-300 ease-out",
                  status === "all" ? "bg-black" : status === "active" ? "bg-action-learn" : "bg-action-learned",
                )}
              >
                <Languages className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{getLanguageDisplayName(selectedLanguage, locale)}</span>
                <span className="text-white/60" aria-hidden="true">•</span>
                <span className="truncate">{statusLabel}</span>
              </div>
          </div>

          <div className="-mx-4 divide-y divide-border border-b border-border bg-background-card">
            {cards.length ? cards.map(({ card, inventory }) => <CardRow key={card.id} card={card} status={inventory.status} locale={locale} onOpen={() => setSelectedCard(card)} />) : (
              <p className="px-4 py-10 text-center text-sm text-foreground-secondary">{t("inventory.emptyAnyDescription")}</p>
            )}
          </div>
        </div>
      ) : null}
      <MobileCardDisplaySheet card={selectedCard} isOpen={selectedCard !== null} onClose={() => setSelectedCard(null)} />
    </section>
  );
}

function CardSpeakerIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        maskImage: "url('/card-icons/hoporlor.png')",
        WebkitMaskImage: "url('/card-icons/hoporlor.png')",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
      aria-hidden="true"
    />
  );
}

function CardRow({ card, status, locale, onOpen }: { card: VocabularyCard; status: InventoryCardView["inventory"]["status"]; locale: Parameters<typeof getCardTranslation>[1]; onOpen: () => void }) {
  const t = useT();
  const example = card.examples[0]?.sentence || card.example;
  const style = TIER_STYLES[card.tier];
  const isLearned = status === "learned";
  const points = getPointsForTier(card.tier);
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }} className="relative flex cursor-pointer gap-3 py-4 pl-14 pr-4 text-left transition-colors hover:bg-background-muted">
      <span className={cn("absolute inset-y-0 left-0 flex w-12 items-center justify-center text-lg font-bold text-white", style.accent)} aria-hidden="true">{card.tier}</span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label={`${card.term} ${t("cards.listen")}`} onClick={(event) => { event.stopPropagation(); vibrate("tap"); speakCardTerm(card.term, card.language); }} className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-brand hover:bg-brand/10">
            <Image src="/card-icons/hoporlor.png" alt="" width={18} height={18} className="size-4 object-contain" aria-hidden="true" />
          </button>
          <p className="min-w-0 flex-1 truncate text-base font-bold text-foreground">{card.term}</p>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", isLearned ? "text-foreground-muted" : "text-white")}>
              <span>{points}</span>
              <ScoreIcon size={15} className={cn("h-4 w-auto", isLearned && "grayscale opacity-60")} />
            </span>
            <span
              className="inline-flex size-6 shrink-0 items-center justify-center"
              title={t(isLearned ? "inventory.status.learned" : "inventory.status.active")}
              aria-label={t(isLearned ? "inventory.status.learned" : "inventory.status.active")}
            >
              <MobileCardStatusArtwork
                status={isLearned ? "learned" : "active"}
                className="size-6"
              />
            </span>
          </div>
        </div>
        <p className="pl-[34px] text-sm text-foreground-secondary">{getCardTranslation(card, locale)}</p>
        <div className="flex items-start gap-1.5 pl-0">
          <button type="button" aria-label={`${example} ${t("cards.listen")}`} onClick={(event) => { event.stopPropagation(); vibrate("tap"); speakText(example, card.language); }} className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-foreground-muted hover:bg-background-muted"><CardSpeakerIcon className="size-4" /></button>
          <p className="pt-1 text-xs leading-5 text-foreground-muted">{example}</p>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, selected, onClick, className, selectedClassName }: { label: string; selected: boolean; onClick: () => void; className?: string; selectedClassName?: string }) {
  return <button type="button" onClick={onClick} className={cn("h-8 min-w-0 w-full rounded-none border-0 px-1 text-center text-[11px] font-semibold leading-tight transition-colors first:rounded-l-md last:rounded-r-md", selected ? cn("bg-foreground text-background", selectedClassName) : cn("bg-background-card text-foreground-secondary", className))}>{label}</button>;
}

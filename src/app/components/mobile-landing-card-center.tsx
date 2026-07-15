"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Volume2 } from "lucide-react";
import { CardsIcon } from "@/components/icons/cards-icon";
import { ScoreIcon } from "@/components/score-icon";
import { MobileCardDisplaySheet } from "@/app/components/mobile-card-display-sheet";
import { getCardTranslation } from "@/features/cards/card-localization";
import { speakCardTerm, speakText } from "@/features/cards/card-speech";
import { TIER_STYLES, TIERS } from "@/data/tiers";
import { getPointsForTier } from "@/features/progress/progress-stats";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import type { InventoryCardView } from "@/features/inventory/inventory-selectors";
import type { Tier, VocabularyCard } from "@/types/domain";

type CardStatusFilter = "all" | "active" | "learned";

const TIER_TEXT_COLOR: Record<Tier, string> = {
  A1: "text-emerald-600 dark:text-emerald-400",
  A2: "text-sky-600 dark:text-sky-400",
  B1: "text-violet-600 dark:text-violet-400",
  B2: "text-amber-600 dark:text-amber-400",
  C1: "text-rose-600 dark:text-rose-400",
};

export function MobileLandingCardCenter({
  activeCards,
  learnedCards,
  onOpenDraw,
  onOpenCreate,
}: {
  activeCards: InventoryCardView[];
  learnedCards: InventoryCardView[];
  onOpenDraw: () => void;
  onOpenCreate: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const [status, setStatus] = useState<CardStatusFilter>("all");
  const [tier, setTier] = useState<Tier | "all">("all");
  const [selectedCard, setSelectedCard] = useState<VocabularyCard | null>(null);
  const [filtersPinned, setFiltersPinned] = useState(false);
  const filterSlotRef = useRef<HTMLDivElement>(null);
  const cards = useMemo(
    () => {
      const sourceCards = status === "active" ? activeCards : status === "learned" ? learnedCards : [...activeCards, ...learnedCards];
      return sourceCards.filter(({ card }) => tier === "all" || card.tier === tier);
    },
    [activeCards, learnedCards, status, tier],
  );

  useEffect(() => {
    const scrollContainer = filterSlotRef.current?.closest<HTMLElement>("[data-mobile-landing-dashboard]");

    if (!scrollContainer) return;

    const updatePinnedState = () => {
      const slotTop = filterSlotRef.current?.getBoundingClientRect().top;
      const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 64;

      setFiltersPinned((current) => {
        const next = typeof slotTop === "number" && slotTop <= headerBottom;
        return current === next ? current : next;
      });
    };

    scrollContainer.addEventListener("scroll", updatePinnedState, { passive: true });

    return () => scrollContainer.removeEventListener("scroll", updatePinnedState);
  }, []);

  return (
    <section className="mt-3 pb-6" aria-label={t("cards.centerTitle")}>
      <div className="flex items-center justify-between border-y border-border bg-background-card px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground">{t("cards.centerTitle")}</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onOpenDraw} aria-label={t("nav.cardDraw")} data-tutorial-target="landing-draw-cards" className="inline-flex size-10 items-center justify-center rounded-md text-brand transition-colors hover:bg-background-muted">
            <CardsIcon className="size-6" aria-hidden="true" />
          </button>
          <button type="button" onClick={onOpenCreate} aria-label={t("cards.createCustom")} className="inline-flex size-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-background-muted">
            <Plus className="size-6" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div ref={filterSlotRef} className={filtersPinned ? "h-[6.5rem]" : undefined}>
        <div
          data-mobile-card-filters
          className={cn(
            "z-40 space-y-2 border-b border-border bg-background px-4 py-3 shadow-sm",
            filtersPinned ? "fixed inset-x-0 top-0" : "relative z-20 -mx-4",
          )}
        >
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-background-muted p-1">
            {(["all", "active", "learned"] as const).map((item) => (
              <button key={item} type="button" onClick={() => setStatus(item)} className={cn("rounded-md px-2 py-2 text-xs font-semibold transition-all duration-300", status === item ? item === "all" ? "bg-white text-black shadow-sm" : item === "active" ? "bg-emerald-500 text-white shadow-sm" : "bg-sky-500 text-white shadow-sm" : "text-foreground-secondary")}>
                {t(`cards.${item === "all" ? "all" : item === "active" ? "toLearn" : "learned"}`)}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <FilterChip label={t("home.mobile.allTiers")} selected={tier === "all"} onClick={() => setTier("all")} />
            {TIERS.map((item) => <FilterChip key={item} label={item} selected={tier === item} onClick={() => setTier(item)} className={TIER_STYLES[item].text} />)}
          </div>
        </div>
      </div>

      <div className="divide-y divide-border border-b border-border bg-background-card">
        {cards.length ? cards.map(({ card, inventory }) => <CardRow key={card.id} card={card} status={inventory.status} locale={locale} onOpen={() => setSelectedCard(card)} />) : (
          <p className="px-4 py-10 text-center text-sm text-foreground-secondary">{t("inventory.emptyAnyDescription")}</p>
        )}
      </div>
      <MobileCardDisplaySheet card={selectedCard} isOpen={selectedCard !== null} onClose={() => setSelectedCard(null)} />
    </section>
  );
}

function CardRow({ card, status, locale, onOpen }: { card: VocabularyCard; status: InventoryCardView["inventory"]["status"]; locale: Parameters<typeof getCardTranslation>[1]; onOpen: () => void }) {
  const t = useT();
  const example = card.examples[0]?.sentence || card.example;
  const style = TIER_STYLES[card.tier];
  const isLearned = status === "learned";
  const points = getPointsForTier(card.tier);
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(); } }} className="relative flex cursor-pointer gap-3 px-4 py-4 text-left transition-colors hover:bg-background-muted">
      <span className={cn("absolute inset-y-0 left-0 w-1.5", style.accent)} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label={`${card.term} ${t("cards.listen")}`} onClick={(event) => { event.stopPropagation(); vibrate("tap"); speakCardTerm(card.term, card.language); }} className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-brand hover:bg-brand/10"><Volume2 className="size-4" aria-hidden="true" /></button>
          <p className="min-w-0 flex-1 truncate text-base font-bold text-foreground">{card.term}</p>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className={cn("text-xs font-bold", TIER_TEXT_COLOR[card.tier])}>{card.tier}</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground-secondary"><span>{points}</span><ScoreIcon size={15} className="h-4 w-auto" /></span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", isLearned ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300" : "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300")}>{t(isLearned ? "inventory.status.learned" : "inventory.status.active")}</span>
          </div>
        </div>
        <p className="pl-[34px] text-sm text-foreground-secondary">{getCardTranslation(card, locale)}</p>
        <div className="flex items-start gap-1.5 pl-0">
          <button type="button" aria-label={`${example} ${t("cards.listen")}`} onClick={(event) => { event.stopPropagation(); vibrate("tap"); speakText(example, card.language); }} className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-foreground-muted hover:bg-background-muted"><Volume2 className="size-4" aria-hidden="true" /></button>
          <p className="pt-1 text-xs leading-5 text-foreground-muted">{example}</p>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, selected, onClick, className }: { label: string; selected: boolean; onClick: () => void; className?: string }) {
  return <button type="button" onClick={onClick} className={cn("shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors", selected ? "border-transparent bg-foreground text-background" : "border-border bg-background-card text-foreground-secondary", className)}>{label}</button>;
}

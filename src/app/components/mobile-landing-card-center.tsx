"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const CARD_GRID_COLUMNS = 3;
const CARD_GRID_OVERSCAN_ROWS = 4;
const CARD_GRID_INITIAL_RENDER_ROWS = 12;
const CARD_GRID_INITIAL_ROW_HEIGHT = 160;

const MobileLandingCardGridItem = memo(function MobileLandingCardGridItem({
  card,
  inventory,
  onSelect,
}: {
  card: InventoryCardView["card"];
  inventory: InventoryCardView["inventory"];
  onSelect: (cardId: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={card.term}
      data-mobile-vocabulary-card
      onClick={() => onSelect(card.id)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect(card.id);
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
  );
});

const VirtualizedMobileLandingCardGrid = memo(function VirtualizedMobileLandingCardGrid({
  cards,
  onSelectCard,
}: {
  cards: InventoryCardView[];
  onSelectCard: (cardId: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef({
    rowHeight: CARD_GRID_INITIAL_ROW_HEIGHT,
    firstRow: 0,
    lastRow: Math.min(CARD_GRID_INITIAL_RENDER_ROWS, Math.ceil(cards.length / CARD_GRID_COLUMNS)),
  });
  const totalRows = Math.ceil(cards.length / CARD_GRID_COLUMNS);
  const [rowHeight, setRowHeight] = useState(CARD_GRID_INITIAL_ROW_HEIGHT);
  const [renderedRows, setRenderedRows] = useState({
    first: 0,
    last: Math.min(CARD_GRID_INITIAL_RENDER_ROWS, totalRows),
  });

  const updateWindow = useCallback(() => {
    const grid = gridRef.current;
    if (!grid || totalRows === 0) return;

    const measuredRowHeight = grid.clientWidth > 0
      ? (grid.clientWidth / CARD_GRID_COLUMNS) * (4 / 3)
      : metricsRef.current.rowHeight;
    const nextRowHeight = Math.max(1, measuredRowHeight);
    const scrollContainer = grid.closest<HTMLElement>("[data-mobile-landing-dashboard]");
    const gridRect = grid.getBoundingClientRect();
    const viewportRect = scrollContainer?.getBoundingClientRect();
    const viewportTop = viewportRect ? viewportRect.top - gridRect.top : 0;
    const viewportBottom = viewportRect
      ? viewportRect.bottom - gridRect.top
      : window.innerHeight - gridRect.top;
    const firstVisibleRow = Math.floor(Math.max(0, viewportTop) / nextRowHeight);
    const lastVisibleRow = Math.ceil(Math.max(0, viewportBottom) / nextRowHeight);
    const firstRow = Math.max(0, Math.min(totalRows, firstVisibleRow - CARD_GRID_OVERSCAN_ROWS));
    const lastRow = Math.max(
      firstRow,
      Math.min(totalRows, lastVisibleRow + CARD_GRID_OVERSCAN_ROWS),
    );

    if (Math.abs(metricsRef.current.rowHeight - nextRowHeight) > 0.5) {
      metricsRef.current.rowHeight = nextRowHeight;
      setRowHeight(nextRowHeight);
    }
    if (metricsRef.current.firstRow === firstRow && metricsRef.current.lastRow === lastRow) return;

    metricsRef.current.firstRow = firstRow;
    metricsRef.current.lastRow = lastRow;
    setRenderedRows({ first: firstRow, last: lastRow });
  }, [totalRows]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const scrollContainer = grid.closest<HTMLElement>("[data-mobile-landing-dashboard]");
    let frame: number | null = null;
    const scheduleUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        updateWindow();
      });
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);

    resizeObserver?.observe(grid);
    scrollContainer?.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    scheduleUpdate();

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      scrollContainer?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [updateWindow]);

  useEffect(() => {
    updateWindow();
  }, [totalRows, updateWindow]);

  const firstRenderedRow = Math.min(renderedRows.first, totalRows);
  const lastRenderedRow = Math.max(firstRenderedRow, Math.min(renderedRows.last, totalRows));

  return (
    <div
      ref={gridRef}
      className="relative -mx-4 bg-background-card"
      data-mobile-card-grid
      style={{ height: totalRows * rowHeight }}
    >
      {Array.from({ length: Math.max(0, lastRenderedRow - firstRenderedRow) }, (_, rowOffset) => {
        const rowIndex = firstRenderedRow + rowOffset;
        const firstCardIndex = rowIndex * CARD_GRID_COLUMNS;
        const rowCards = cards.slice(firstCardIndex, firstCardIndex + CARD_GRID_COLUMNS);

        return (
          <div
            key={`mobile-card-grid-row-${rowIndex}`}
            className="absolute inset-x-0 top-0 grid grid-cols-3 gap-0"
            style={{
              height: rowHeight,
              transform: `translate3d(0, ${rowIndex * rowHeight}px, 0)`,
            }}
          >
            {rowCards.map(({ card, inventory }) => (
              <MobileLandingCardGridItem
                key={`${card.id}-${String(inventory.status ?? "").trim().toLowerCase()}`}
                card={card}
                inventory={inventory}
                onSelect={onSelectCard}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
});

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
  const [podiumOpen, setPodiumOpen] = useState(false);
  const [podiumMode, setPodiumMode] = useState<"collection" | "review">("collection");
  const drawActionRef = useRef<HTMLDivElement>(null);
  const cards = useMemo(
    () => {
      const sourceCards = status === "active" ? activeCards : status === "learned" ? learnedCards : [...activeCards, ...learnedCards];
      // Keep the optimistic and cloud-backed views in the same newest-first order.
      return [...sourceCards]
        .sort((left, right) => Date.parse(right.inventory.addedAt) - Date.parse(left.inventory.addedAt));
    },
    [activeCards, learnedCards, status],
  );

  function handleToggle() {
    onOpenChange(!isOpen);
  }

  function openReviewMode() {
    const firstCard = activeCards[0]?.card;
    if (!firstCard) return;

    setPodiumMode("review");
    setSelectedCardId(firstCard.id);
    setPodiumOpen(true);
  }

  const handleCardSelect = useCallback((cardId: string) => {
    setPodiumMode("collection");
    setSelectedCardId(cardId);
    setPodiumOpen(true);
  }, []);

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

          {cards.length ? (
            <VirtualizedMobileLandingCardGrid cards={cards} onSelectCard={handleCardSelect} />
          ) : (
              <p className="col-span-3 px-4 py-10 text-center text-sm text-foreground-secondary">
                {t("home.mobile.noWordsInLanguage", {
                  language: getLanguageDisplayName(selectedLanguage, locale),
                })}
              </p>
          )}
        </div>
      ) : null}
      <MobileCardPodiumOverlay
        items={cards}
        reviewActiveItems={activeCards}
        reviewLearnedItems={learnedCards}
        selectedCardId={selectedCardId}
        isOpen={podiumOpen}
        onSelectedCardChange={setSelectedCardId}
        onClose={() => {
          // Keep the selected card id stable while the close animation runs.
          // Clearing it here remounts the overlay against the first review card.
          setPodiumOpen(false);
        }}
        mode={podiumMode}
      />
    </section>
  );
}

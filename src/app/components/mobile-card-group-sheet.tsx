"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, FolderPlus } from "lucide-react";
import { createPortal } from "react-dom";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { MobileCardDisplaySheet } from "@/app/components/mobile-card-display-sheet";
import { TIER_STYLES } from "@/data/tiers";
import { getCardTranslation } from "@/features/cards/card-localization";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import {
  CARD_GROUPS,
  CARD_GROUP_IMAGE_PATHS,
  getCardsForGroup,
  type CardGroupIcon,
} from "@/features/cards/card-groups";
import { formatNumber } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { ActiveCardLimitDetails, LanguageCode, LimitErrorCode, VocabularyCard } from "@/types/domain";

interface MobileCardGroupSheetProps {
  open: boolean;
  onClose: () => void;
  language: LanguageCode;
  onSubscriptionLimitReached?: (errorCode: LimitErrorCode, details?: ActiveCardLimitDetails) => void;
}

export function MobileCardGroupSheet({
  open,
  onClose,
  language,
  onSubscriptionLimitReached,
}: MobileCardGroupSheetProps) {
  const { locale } = useLocale();
  const t = useT();
  const usesSuperWater = canUseSuperWater(locale);
  const displayText = (text: string) => formatSuperWaterText(locale, text);
  const cards = useInventoryStore((state) => state.cards);
  const addCards = useInventoryStore((state) => state.addCards);
  const [addingGroupId, setAddingGroupId] = useState<CardGroupIcon | null>(null);
  const [addingCardId, setAddingCardId] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<CardGroupIcon | null>(null);
  const [addedCounts, setAddedCounts] = useState<Partial<Record<CardGroupIcon, number>>>({});
  const [errorGroupId, setErrorGroupId] = useState<CardGroupIcon | null>(null);
  const [selectedCard, setSelectedCard] = useState<VocabularyCard | null>(null);
  const [selectedCardSourceRect, setSelectedCardSourceRect] = useState<DOMRect | null>(null);
  const [confirmationClosing, setConfirmationClosing] = useState(false);
  const confirmationCloseTimerRef = useRef<number | null>(null);
  const [pendingGroup, setPendingGroup] = useState<{
    groupId: CardGroupIcon;
    cardIds: string[];
    sourceRect: DOMRect | null;
  } | null>(null);

  const inventoryIds = useMemo(() => new Set(cards.map((card) => card.cardId)), [cards]);
  const groups = useMemo(
    () => CARD_GROUPS.map((definition) => {
      const groupCards = getCardsForGroup(definition.id, language);
      const newCards = groupCards.filter((card) => !inventoryIds.has(card.id) && !inventoryIds.has(card.sourceKey));

      return {
        definition,
        groupCards,
        total: groupCards.length,
        owned: groupCards.length - newCards.length,
        newCards,
      };
    }).filter((item) => item.total > 0),
    [inventoryIds, language],
  );

  async function handleAddGroup(groupId: CardGroupIcon, cardIds: string[]) {
    if (addingGroupId !== null || addingCardId !== null || cardIds.length === 0) return;

    setAddingGroupId(groupId);
    setErrorGroupId(null);

    try {
      const result = await addCards(cardIds);

      if (!result.ok) {
        setErrorGroupId(groupId);
        return;
      }

      if (result.addedCardIds.length > 0) {
        setAddedCounts((current) => ({ ...current, [groupId]: result.addedCardIds.length }));
      }

      if (result.limitReached) {
        onSubscriptionLimitReached?.("free_active_card_limit", {
          addedCount: result.addedCardIds.length,
          skippedCount: result.remainingCardIds.length,
        });
      }
    } catch {
      setErrorGroupId(groupId);
    } finally {
      setAddingGroupId(null);
    }
  }

  function requestAddGroup(groupId: CardGroupIcon, cardIds: string[], sourceRect: DOMRect | null = null) {
    if (addingGroupId !== null || addingCardId !== null || cardIds.length === 0) return;

    setErrorGroupId(null);
    setConfirmationClosing(false);
    setPendingGroup({ groupId, cardIds, sourceRect });
  }

  function closeConfirmation(afterClose?: () => void) {
    if (!pendingGroup || confirmationClosing) return;

    setConfirmationClosing(true);
    confirmationCloseTimerRef.current = window.setTimeout(() => {
      setPendingGroup(null);
      setConfirmationClosing(false);
      confirmationCloseTimerRef.current = null;
      afterClose?.();
    }, 860);
  }

  function handleClose() {
    if (confirmationCloseTimerRef.current !== null) {
      window.clearTimeout(confirmationCloseTimerRef.current);
      confirmationCloseTimerRef.current = null;
    }
    setPendingGroup(null);
    setConfirmationClosing(false);
    onClose();
  }

  async function handleAddCard(groupId: CardGroupIcon, cardId: string) {
    if (addingGroupId !== null || addingCardId !== null) return;

    setAddingCardId(cardId);
    setErrorGroupId(null);

    try {
      const result = await addCards([cardId]);

      if (!result.ok) {
        setErrorGroupId(groupId);
        return;
      }

      if (result.limitReached) {
        onSubscriptionLimitReached?.("free_active_card_limit");
      }
    } catch {
      setErrorGroupId(groupId);
    } finally {
      setAddingCardId(null);
    }
  }

  const confirmationDialog = open && pendingGroup && typeof document !== "undefined"
    ? createPortal(
        <div className={cn(
          "card-group-confirm-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-5 py-6",
          confirmationClosing && "card-group-confirm-overlay--closing",
          usesSuperWater && "font-super-water",
        )}
        style={{
          transformOrigin: pendingGroup.sourceRect
            ? `${pendingGroup.sourceRect.left + pendingGroup.sourceRect.width / 2}px ${pendingGroup.sourceRect.top + pendingGroup.sourceRect.height / 2}px`
            : `${window.innerWidth / 2}px ${window.innerHeight / 2}px`,
        }}
        data-tutorial-layer="card-groups">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-group-confirm-title"
            className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#131313] p-5 text-white shadow-sm"
          >
            <h3
              id="card-group-confirm-title"
              className="card-group-confirm-overlay__item text-center text-lg font-semibold leading-snug"
              style={{ animationDelay: "520ms" }}
            >
              {displayText(t("cards.groups.confirmMessage", {
                count: formatNumber(locale, pendingGroup.cardIds.length),
              }))}
            </h3>
            <div
              className="card-group-confirm-overlay__item mt-5 grid grid-cols-2 gap-2"
              style={{ animationDelay: "590ms" }}
            >
              <button
                type="button"
                disabled={confirmationClosing}
                onClick={() => closeConfirmation()}
                className="rounded-lg bg-red-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                {displayText(t("cards.groups.confirmCancel"))}
              </button>
              <button
                type="button"
                disabled={confirmationClosing}
                onClick={() => {
                  const group = pendingGroup;
                  closeConfirmation(() => {
                    void handleAddGroup(group.groupId, group.cardIds);
                  });
                }}
                className="rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
              >
                {displayText(t("cards.groups.confirmAdd"))}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  const cardDisplay = typeof document !== "undefined"
    ? createPortal(
        <MobileCardDisplaySheet
          card={selectedCard}
          isOpen={selectedCard !== null}
          sourceRect={selectedCardSourceRect}
          onClose={() => setSelectedCard(null)}
          positionClassName="-translate-y-6"
          tutorialLayer="card-groups"
        />,
        document.body,
      )
    : null;

  return (
    <>
      <MobileBottomSheetShell
        open={open}
        onClose={handleClose}
        title={t("cards.groups.title")}
        panelLabel={t("cards.groups.title")}
        tutorialLayer="card-groups"
        visual={<FolderPlus className="size-[3.25rem] stroke-[2.5] text-brand-foreground" aria-hidden="true" />}
        contentClassName={cn(
          "overflow-y-auto overscroll-contain px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3",
          usesSuperWater && "font-super-water",
        )}
      >
        <div className="mb-4 rounded-2xl bg-black/10 px-4 py-3 text-center text-sm font-medium text-brand-foreground/85">
          {displayText(t("cards.groups.description"))}
        </div>

        <div className="space-y-3">
          {groups.map(({ definition, groupCards, total, owned, newCards }) => {
          const isAdding = addingGroupId === definition.id;
          const isComplete = newCards.length === 0;
          const addedCount = addedCounts[definition.id];

            return (
              <article
                key={definition.id}
                className="rounded-2xl border border-brand-foreground/15 bg-[#131313] p-3 transition-colors duration-300"
              >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setExpandedGroupId((current) => current === definition.id ? null : definition.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition-transform duration-300 active:scale-[0.99]"
                  aria-expanded={expandedGroupId === definition.id}
                  aria-controls={`mobile-card-group-${definition.id}`}
                >
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl">
                    <Image
                      src={CARD_GROUP_IMAGE_PATHS[definition.id]}
                      alt=""
                      width={64}
                      height={64}
                      className="size-12 object-contain"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      role="heading"
                      aria-level={3}
                      className={cn(
                        "block text-base font-semibold leading-tight text-brand-foreground",
                        usesSuperWater ? "font-super-water" : "font-display",
                      )}
                    >
                      {displayText(t(definition.labelKey))}
                    </span>
                    <span className="mt-1 block truncate text-xs text-brand-foreground/70">
                      {displayText(t("cards.groups.groupDescription", { group: t(definition.labelKey) }))}
                    </span>
                    <span className="mt-1 block text-xs text-brand-foreground/70">
                      {displayText(t("cards.groups.progress", {
                        owned: formatNumber(locale, owned),
                        total: formatNumber(locale, total),
                      }))}
                    </span>
                  </span>
                  <ChevronDown className={cn("size-5 shrink-0 text-brand-foreground/70 transition-transform duration-300", expandedGroupId === definition.id && "rotate-180")} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={(event) => requestAddGroup(definition.id, newCards.map((card) => card.sourceKey), event.currentTarget.getBoundingClientRect())}
                  disabled={isAdding || isComplete || addingGroupId !== null || addingCardId !== null}
                  className={cn(
                    "shrink-0 rounded-full bg-brand-foreground px-3 py-2 text-xs font-semibold text-brand transition-all duration-300 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-55",
                    isAdding && "animate-pulse",
                  )}
                  aria-label={`${t(definition.labelKey)} ${t(isAdding ? "cards.groups.adding" : isComplete ? "cards.groups.inDeck" : "cards.groups.add")}`}
                >
                  {isAdding
                    ? displayText(t("cards.groups.adding"))
                    : isComplete
                      ? displayText(t("cards.groups.inDeck"))
                    : displayText(t("cards.groups.add"))}
                </button>
              </div>

              {expandedGroupId === definition.id ? (
                <div id={`mobile-card-group-${definition.id}`} className="mt-3 space-y-2 border-t border-brand-foreground/15 pt-3">
                  {groupCards.map((card) => {
                    const isOwned = inventoryIds.has(card.id) || inventoryIds.has(card.sourceKey);
                    const isAddingCard = addingCardId === card.sourceKey;
                    const tierStyle = TIER_STYLES[card.tier];

                    return (
                      <div
                        key={card.id}
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          setSelectedCardSourceRect(event.currentTarget.getBoundingClientRect());
                          setSelectedCard(card);
                        }}
                        onKeyDown={(event) => {
                          if ((event.target as HTMLElement).closest("button")) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedCardSourceRect(event.currentTarget.getBoundingClientRect());
                            setSelectedCard(card);
                          }
                        }}
                        aria-label={card.term}
                        className={cn("flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-white transition-transform duration-200 hover:scale-[1.01]", tierStyle.accent)}
                      >
                        <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white", tierStyle.softAccent)}>
                          {card.tier}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-black">{displayText(card.term)}</p>
                          <p className="truncate text-xs text-black/70">{displayText(getCardTranslation(card, locale))}</p>
                        </div>
                        {isOwned ? (
                          <Image
                            src="/card-icons/card-in-deck-tick.png"
                            alt={t("cards.groups.inDeck")}
                            width={32}
                            height={32}
                            className="size-8 shrink-0 object-contain"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleAddCard(definition.id, card.sourceKey);
                            }}
                            disabled={isAddingCard || addingCardId !== null || addingGroupId !== null}
                            className={cn(
                              "min-w-[5.5rem] shrink-0 rounded-lg px-2 py-2 text-[10px] font-semibold leading-tight transition-transform duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-55",
                              "bg-background-card text-foreground",
                              isAddingCard && "animate-pulse",
                            )}
                            aria-label={`${card.term} ${t(isAddingCard ? "cards.groups.adding" : "cards.addToDeck")}`}
                          >
                            {isAddingCard ? displayText(t("cards.groups.adding")) : displayText(t("cards.addToDeck"))}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {addedCount ? (
                <p className="mt-2 pl-[3.75rem] text-xs font-semibold text-brand-foreground">
                  {displayText(t("cards.groups.added", { count: formatNumber(locale, addedCount) }))}
                </p>
              ) : null}
              {errorGroupId === definition.id ? (
                <p className="mt-2 pl-[3.75rem] text-xs font-semibold text-brand-foreground/85">
                  {displayText(t("cards.groups.error"))}
                </p>
              ) : null}
              </article>
            );
          })}
        </div>
      </MobileBottomSheetShell>
      {confirmationDialog}
      {cardDisplay}
    </>
  );
}

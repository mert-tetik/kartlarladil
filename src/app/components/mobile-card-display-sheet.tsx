"use client";

import { useEffect, useRef, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from "react";
import Image from "next/image";
import { MessageCircleQuestion, X } from "lucide-react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { useAskOverlay } from "@/features/ask/components/ask-overlay-provider";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { getCardDefinition } from "@/data/card-definitions";
import { getStudyLocale } from "@/features/cards/card-localization";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { useAuthSession } from "@/features/auth/auth-client";
import { markCardLearnedWithGemAction, removeCardWithGemAction } from "@/features/gems/gem-actions";
import { GEM_ASSETS, type GemType } from "@/features/gems/gem-types";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import type { VocabularyCard } from "@/types/domain";

interface MobileCardDisplaySheetProps {
  card: VocabularyCard | null;
  isOpen: boolean;
  onClose: () => void;
  positionClassName?: string;
  tutorialLayer?: string;
  sourceRect?: DOMRect | null;
}

const CARD_DISPLAY_ENTER_DELAY_MS = 520;
const CARD_DISPLAY_CONTENT_STEP_MS = 70;
const CARD_DISPLAY_CLOSE_ANIMATION_MS = 860;

export function MobileCardDisplaySheet({
  card,
  isOpen,
  onClose,
  positionClassName,
  tutorialLayer,
  sourceRect = null,
}: MobileCardDisplaySheetProps) {
  const { locale } = useLocale();
  const t = useT();
  const { openAsk } = useAskOverlay();
  const requireAuth = useRequireAuthAction();
  const { user, updateProfileField, refreshProfile } = useAuthSession();
  const loadCloudInventory = useInventoryStore((state) => state.loadCloudInventory);
  const [confirmation, setConfirmation] = useState<GemType | null>(null);
  const [confirmationSourceRect, setConfirmationSourceRect] = useState<DOMRect | null>(null);
  const [confirmationClosing, setConfirmationClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [face, setFace] = useState<"front" | "back">("back");
  const [displayedCard, setDisplayedCard] = useState<VocabularyCard | null>(card);
  const [presented, setPresented] = useState(Boolean(isOpen && card));
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const confirmationCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen && card) {
      setDisplayedCard(card);
      setPresented(true);
      setClosing(false);
      setEntered(false);
      setFace("back");
      const frame = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(frame);
    }

    if (!presented) return;

    setClosing(true);
    setEntered(false);
    const timer = window.setTimeout(() => {
      setPresented(false);
      setClosing(false);
      setDisplayedCard(null);
    }, CARD_DISPLAY_CLOSE_ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [card, isOpen, presented]);

  useEffect(() => () => {
    if (confirmationCloseTimerRef.current !== null) {
      window.clearTimeout(confirmationCloseTimerRef.current);
    }
  }, []);

  const inventory = useInventoryStore((state) =>
    displayedCard ? state.cards.find((item) => item.cardId === displayedCard.id) : undefined,
  );

  if (!displayedCard || !presented) return null;

  const currentCard = displayedCard;
  const definition = getCardDefinition(currentCard, getStudyLocale(currentCard.language, locale));

  function handleBackdropClick() {
    onClose();
  }

  function handleCardAreaClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    setFace((current) => (current === "front" ? "back" : "front"));
  }

  function handleAskClick() {
    const askPath = `/ask/${currentCard.language}?term=${encodeURIComponent(currentCard.term)}`;
    requireAuth(() => {
      onClose();
      openAsk({ contextLanguage: currentCard.language, initialTerm: currentCard.term });
    }, { nextPath: askPath });
  }

  const actionButtonClass =
    "inline-flex size-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60";

  const blueBalance = user?.profile.blueGems ?? 0;
  const purpleBalance = user?.profile.purpleGems ?? 0;

  function requestGemAction(type: GemType, source?: DOMRect) {
    if (!user) {
      requireAuth(() => undefined, { nextPath: "/" });
      return;
    }
    setConfirmationSourceRect(source ?? null);
    setConfirmationClosing(false);
    setConfirmation(type);
  }

  function closeConfirmation(afterClose?: () => void) {
    if (!confirmation || confirmationClosing) return;

    setConfirmationClosing(true);
    confirmationCloseTimerRef.current = window.setTimeout(() => {
      setConfirmation(null);
      setConfirmationSourceRect(null);
      setConfirmationClosing(false);
      confirmationCloseTimerRef.current = null;
      afterClose?.();
    }, CARD_DISPLAY_CLOSE_ANIMATION_MS);
  }

  async function confirmGemAction() {
    if (!confirmation || !user || busy || confirmationClosing) return;
    const confirmedType = confirmation;
    setBusy(true);
    const result = confirmedType === "blue"
      ? await removeCardWithGemAction(currentCard.sourceKey)
      : await markCardLearnedWithGemAction(currentCard.sourceKey);
    if (result.success && result.balances) {
      updateProfileField({ blueGems: result.balances.blue, greenGems: result.balances.green, purpleGems: result.balances.purple });
      playSoundEffect("gem-spend");
      vibrate("tap");
      await Promise.all([refreshProfile(), loadCloudInventory()]);
      closeConfirmation(() => {
        if (confirmedType === "blue") onClose();
      });
    }
    setBusy(false);
  }

  const contentItemCount = 4;
  const origin = sourceRect
    ? {
        x: sourceRect.left + sourceRect.width / 2,
        y: sourceRect.top + sourceRect.height / 2,
      }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  function renderContentItem(index: number, children: ReactNode, className?: string) {
    return (
      <div
        className={cn("card-display-overlay__item", className)}
        style={{
          animationDelay: closing
            ? `${(contentItemCount - index - 1) * CARD_DISPLAY_CONTENT_STEP_MS}ms`
            : `${CARD_DISPLAY_ENTER_DELAY_MS + index * CARD_DISPLAY_CONTENT_STEP_MS}ms`,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "card-display-overlay fixed inset-0 z-[60] overflow-y-auto bg-black/60 px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] max-lg:block lg:hidden",
        !entered && !closing && "card-display-overlay--preparing",
        closing && "card-display-overlay--closing",
      )}
      style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}
      aria-hidden={!isOpen}
      inert={!isOpen}
      onClick={handleBackdropClick}
      data-mobile-card-display-sheet
      data-tutorial-layer={tutorialLayer}
    >
      <div
        className={cn("relative mx-auto flex min-h-full w-full max-w-[320px] flex-col items-center justify-center py-14", positionClassName)}
        onClick={(event) => event.stopPropagation()}
      >
        {renderContentItem(
          0,
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAskClick}
              aria-label={`${currentCard.term} ${t("cards.ask")}`}
              title={t("cards.ask")}
              className={actionButtonClass}
            >
              <MessageCircleQuestion className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              title={t("common.close")}
              className={actionButtonClass}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>,
          "absolute right-0 top-2",
        )}

        {renderContentItem(
          1,
          <div className="w-full max-w-[260px]" onClick={handleCardAreaClick}>
            <VocabularyCardView
              card={currentCard}
              inventory={inventory}
              owned
              face={face}
              initialFace="back"
              flippable={false}
              showActions={false}
              frontFit
              className="h-auto w-full max-w-[260px] max-sm:min-h-[340px]"
            />
          </div>,
          "w-full",
        )}

        {definition ? (
          renderContentItem(
            2,
            <div className="mt-3 flex w-full max-w-[300px] flex-col gap-2.5" data-card-supporting-content>
              <section className="w-full px-2 py-1 text-center" data-card-definition>
                <p className="text-[0.68rem] font-bold uppercase tracking-wider text-[var(--brand)]">
                  {t("cards.definition")}
                </p>
                <p className="mt-1 text-sm font-semibold leading-5 text-foreground dark:text-white">
                  {definition}
                </p>
              </section>
            </div>,
            "w-full",
          )
        ) : null}

        {renderContentItem(
          3,
          <div className="mt-3 flex w-full max-w-[300px] flex-col gap-2" data-card-gem-actions>
            <GemCardAction type="blue" cost={10} balance={blueBalance} disabled={!user || blueBalance < 10 || !inventory} label={t("gems.removeCard")} onClick={(event) => requestGemAction("blue", event.currentTarget.getBoundingClientRect())} />
            {inventory?.status === "active" ? (
              <GemCardAction type="purple" cost={2} balance={purpleBalance} disabled={!user || purpleBalance < 2} label={t("gems.markLearned")} onClick={(event) => requestGemAction("purple", event.currentTarget.getBoundingClientRect())} />
            ) : null}
          </div>,
          "w-full",
        )}
      </div>

      {confirmation ? (
        <div
          className={cn(
            "card-gem-confirm-overlay fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-5",
            confirmationClosing && "card-gem-confirm-overlay--closing",
          )}
          style={{
            transformOrigin: confirmationSourceRect
              ? `${confirmationSourceRect.left + confirmationSourceRect.width / 2}px ${confirmationSourceRect.top + confirmationSourceRect.height / 2}px`
              : `${window.innerWidth / 2}px ${window.innerHeight / 2}px`,
          }}
          role="dialog"
          aria-modal="true"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="card-gem-confirm-overlay__item w-full max-w-xs rounded-3xl bg-background-card p-5 text-center shadow-lg">
            <p className="text-base font-semibold text-foreground">{t(confirmation === "blue" ? "gems.confirmRemove" : "gems.confirmLearned")}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy || confirmationClosing} onClick={() => closeConfirmation()} className="min-h-11 flex-1 rounded-full bg-black px-3 py-2 text-sm font-bold text-[var(--brand)] disabled:opacity-50">{t("gems.cancel")}</button>
              <button type="button" disabled={busy || confirmationClosing} onClick={() => void confirmGemAction()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full bg-[var(--brand)] px-3 py-2 text-sm font-bold text-[var(--brand-foreground)] disabled:opacity-50">
                {t("gems.confirm")} {confirmation === "blue" ? 10 : 2}<Image src={GEM_ASSETS[confirmation]} alt="" width={20} height={20} className="size-5 object-contain" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

function GemCardAction({ type, cost, balance, disabled, label, onClick }: { type: GemType; cost: number; balance: number; disabled: boolean; label: string; onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cn("flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40", type === "blue" ? "bg-[#268cff]" : "bg-[#9b31dc]")}>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap" aria-label={`${cost}`}>
        <span>{cost}</span>
        <Image src={GEM_ASSETS[type]} alt="" width={24} height={24} className="size-6 object-contain" />
      </span>
      <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-xs text-white/80">
        <span>{balance}/{cost}</span>
        <Image src={GEM_ASSETS[type]} alt="" width={16} height={16} className="size-4 object-contain" />
      </span>
    </button>
  );
}

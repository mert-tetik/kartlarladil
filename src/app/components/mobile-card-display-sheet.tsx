"use client";

import { useState } from "react";
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
}

export function MobileCardDisplaySheet({ card, isOpen, onClose, positionClassName, tutorialLayer }: MobileCardDisplaySheetProps) {
  const { locale } = useLocale();
  const t = useT();
  const { openAsk } = useAskOverlay();
  const requireAuth = useRequireAuthAction();
  const { user, updateProfileField, refreshProfile } = useAuthSession();
  const loadCloudInventory = useInventoryStore((state) => state.loadCloudInventory);
  const [confirmation, setConfirmation] = useState<GemType | null>(null);
  const [busy, setBusy] = useState(false);
  const [face, setFace] = useState<"front" | "back">("back");
  const inventory = useInventoryStore((state) =>
    card ? state.cards.find((item) => item.cardId === card.id) : undefined,
  );

  if (!card) return null;

  const currentCard = card;
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

  function requestGemAction(type: GemType) {
    if (!user) {
      requireAuth(() => undefined, { nextPath: "/" });
      return;
    }
    setConfirmation(type);
  }

  async function confirmGemAction() {
    if (!confirmation || !user || busy) return;
    setBusy(true);
    const result = confirmation === "blue"
      ? await removeCardWithGemAction(currentCard.sourceKey)
      : await markCardLearnedWithGemAction(currentCard.sourceKey);
    if (result.success && result.balances) {
      updateProfileField({ blueGems: result.balances.blue, greenGems: result.balances.green, purpleGems: result.balances.purple });
      playSoundEffect("gem-spend");
      vibrate("tap");
      await Promise.all([refreshProfile(), loadCloudInventory()]);
      setConfirmation(null);
      if (confirmation === "blue") onClose();
    }
    setBusy(false);
  }

  return (
    <div
      key={`${card.id}-${isOpen ? "open" : "closed"}`}
      className={cn(
        "fixed inset-0 z-[60] overflow-y-auto bg-black/60 px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] transition-opacity duration-300 max-lg:block lg:hidden",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
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
        <div className="absolute right-0 top-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleAskClick}
            aria-label={`${card.term} ${t("cards.ask")}`}
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
        </div>

        <div className="w-full max-w-[260px]" onClick={handleCardAreaClick}>
          <VocabularyCardView
            card={card}
            inventory={inventory}
            owned
            face={face}
            initialFace="back"
            flippable={false}
            showActions={false}
            frontFit
            className="h-auto w-full max-w-[260px] max-sm:min-h-[340px]"
          />
        </div>

        {definition ? (
          <div className="mt-3 flex w-full max-w-[300px] flex-col gap-2.5" data-card-supporting-content>
            <section className="w-full px-2 py-1 text-center" data-card-definition>
              <p className="text-[0.68rem] font-bold uppercase tracking-wider text-[var(--brand)]">
                {t("cards.definition")}
              </p>
              <p className="mt-1 text-sm font-semibold leading-5 text-foreground dark:text-white">
                {definition}
              </p>
            </section>
          </div>
        ) : null}

        <div className="mt-3 flex w-full max-w-[300px] flex-col gap-2" data-card-gem-actions>
          <GemCardAction type="blue" cost={10} balance={blueBalance} disabled={!user || blueBalance < 10 || !inventory} label={t("gems.removeCard")} onClick={() => requestGemAction("blue")} />
          {inventory?.status === "active" ? (
            <GemCardAction type="purple" cost={2} balance={purpleBalance} disabled={!user || purpleBalance < 2} label={t("gems.markLearned")} onClick={() => requestGemAction("purple")} />
          ) : null}
        </div>
      </div>

      {confirmation ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-5" role="dialog" aria-modal="true">
          <div className="w-full max-w-xs rounded-3xl bg-background-card p-5 text-center shadow-lg">
            <p className="text-base font-semibold text-foreground">{t(confirmation === "blue" ? "gems.confirmRemove" : "gems.confirmLearned")}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setConfirmation(null)} className="min-h-11 flex-1 rounded-full bg-black px-3 py-2 text-sm font-bold text-[var(--brand)]">{t("gems.cancel")}</button>
              <button type="button" disabled={busy} onClick={() => void confirmGemAction()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full bg-[var(--brand)] px-3 py-2 text-sm font-bold text-[var(--brand-foreground)] disabled:opacity-50">
                {t("gems.confirm")} {confirmation === "blue" ? 10 : 2}<Image src={GEM_ASSETS[confirmation]} alt="" width={20} height={20} className="size-5 object-contain" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

function GemCardAction({ type, cost, balance, disabled, label, onClick }: { type: GemType; cost: number; balance: number; disabled: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cn("flex min-h-11 items-center justify-between rounded-2xl px-3 py-2 text-left text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40", type === "blue" ? "bg-[#268cff]" : "bg-[#9b31dc]")}>
      <span className="inline-flex items-center gap-2"><Image src={GEM_ASSETS[type]} alt="" width={24} height={24} className="size-6 object-contain" /><span>{cost} · {label}</span></span>
      <span className="text-xs text-white/80">{balance}</span>
    </button>
  );
}

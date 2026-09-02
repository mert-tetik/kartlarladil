"use client";

import { useState } from "react";
import { MessageCircleQuestion, X } from "lucide-react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { useAskOverlay } from "@/features/ask/components/ask-overlay-provider";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { getCardDefinition } from "@/data/card-definitions";
import { getCardExampleTranslation, getStudyLocale } from "@/features/cards/card-localization";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { VocabularyCard } from "@/types/domain";

interface MobileCardDisplaySheetProps {
  card: VocabularyCard | null;
  isOpen: boolean;
  onClose: () => void;
  positionClassName?: string;
}

export function MobileCardDisplaySheet({ card, isOpen, onClose, positionClassName }: MobileCardDisplaySheetProps) {
  const { locale } = useLocale();
  const t = useT();
  const { openAsk } = useAskOverlay();
  const requireAuth = useRequireAuthAction();
  const [face, setFace] = useState<"front" | "back">("back");
  const inventory = useInventoryStore((state) =>
    card ? state.cards.find((item) => item.cardId === card.id) : undefined,
  );

  if (!card) return null;

  const currentCard = card;
  const definition = getCardDefinition(currentCard, getStudyLocale(currentCard.language, locale));
  const examples = currentCard.examples;

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

        {(definition || examples.length > 0 || currentCard.example.trim()) ? (
          <div className="mt-3 flex w-full max-w-[300px] flex-col gap-2.5" data-card-supporting-content>
            {definition ? (
              <section
                className="w-full rounded-xl border border-[color:var(--brand)]/55 bg-[color-mix(in_oklab,var(--brand)_18%,var(--background-card))] px-4 py-3 text-center"
                data-card-definition
              >
                <p className="text-[0.68rem] font-bold uppercase tracking-wider text-[var(--brand)]">
                  {t("cards.definition")}
                </p>
                <p className="mt-1 text-sm font-semibold leading-5 text-foreground dark:text-white">
                  {definition}
                </p>
              </section>
            ) : null}

            {examples.length > 0 ? (
              <section className="w-full space-y-2" data-card-example-sentences>
                <p className="px-1 text-center text-[0.68rem] font-bold uppercase tracking-wider text-white/75">
                  {t("cards.exampleSentences")}
                </p>
                {examples.map((example, index) => (
                  <article
                    key={example.id}
                    className={cn(
                      "rounded-xl border px-3.5 py-3 text-left text-white",
                      index % 3 === 0
                        ? "border-[color:var(--tier-a1)]/55 bg-[color-mix(in_oklab,var(--tier-a1)_22%,#121212)]"
                        : index % 3 === 1
                          ? "border-[color:var(--tier-a2)]/55 bg-[color-mix(in_oklab,var(--tier-a2)_22%,#121212)]"
                          : "border-[color:var(--tier-b1)]/55 bg-[color-mix(in_oklab,var(--tier-b1)_22%,#121212)]",
                    )}
                  >
                    <p className="text-sm font-semibold leading-5">{example.sentence}</p>
                    {getCardExampleTranslation(example, locale) ? (
                      <p className="mt-1.5 text-xs leading-4 text-white/75">
                        {getCardExampleTranslation(example, locale)}
                      </p>
                    ) : null}
                  </article>
                ))}
              </section>
            ) : currentCard.example.trim() ? (
              <section className="w-full space-y-2" data-card-example-sentences>
                <p className="px-1 text-center text-[0.68rem] font-bold uppercase tracking-wider text-white/75">
                  {t("cards.exampleSentences")}
                </p>
                <article className="rounded-xl border border-[color:var(--tier-a1)]/55 bg-[color-mix(in_oklab,var(--tier-a1)_22%,#121212)] px-3.5 py-3 text-left text-white">
                  <p className="text-sm font-semibold leading-5">{currentCard.example}</p>
                  {currentCard.exampleTranslation.trim() ? (
                    <p className="mt-1.5 text-xs leading-4 text-white/75">{currentCard.exampleTranslation}</p>
                  ) : null}
                </article>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>

    </div>
  );
}

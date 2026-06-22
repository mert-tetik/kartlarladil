"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { BookOpenText, X } from "lucide-react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { TIER_STYLES } from "@/data/tiers";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getCardExampleTranslation,
  getCardTranslation,
} from "@/features/cards/card-localization";
import { getExampleContextLabel, getLanguageDisplayName, getPartOfSpeechLabel, getTierLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import type { VocabularyCard } from "@/types/domain";

export function CardDetailsDialog({
  card,
  open,
  onOpenChange,
}: {
  card: VocabularyCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const { locale } = useLocale();
  const t = useT();
  const style = TIER_STYLES[card.tier];

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onOpenChange, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60 p-0 sm:items-center sm:justify-center sm:p-6"
      onMouseDown={() => onOpenChange(false)}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="animate-menu-pop relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-lg border border-border bg-background-card shadow-lg sm:max-w-4xl sm:rounded-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={t("cards.closeDetails")}
          onClick={() => onOpenChange(false)}
          onMouseDown={(event) => {
            event.stopPropagation();
            onOpenChange(false);
          }}
          className="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-full text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        <div className="shrink-0 px-5 pt-12 sm:pt-5">
          <VocabularyCardView
            card={card}
            initialFace="front"
            flippable={false}
            showActions={false}
            className="mx-auto h-[272px] w-full max-w-[204px] sm:h-[344px] sm:max-w-[258px]"
          />
        </div>

        <div className={cn("shrink-0 border-b p-5", style.surface, style.border)}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border-transparent bg-background-card/80", style.text)}>
                {card.tier} · {getTierLabel(card.tier, locale)}
              </Badge>
              <Badge className="border-transparent bg-background-card/80 text-foreground-secondary">
                {getLanguageDisplayName(card.language, locale)}
              </Badge>
              <Badge className="border-transparent bg-background-card/80 text-foreground-secondary">
                {getPartOfSpeechLabel(card.termKind, locale)}
              </Badge>
            </div>
            <h2 id={titleId} className="mt-4 font-display text-3xl font-semibold leading-tight text-foreground">
              {card.term} {t("cards.details")}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-foreground-secondary">
              {getCardTranslation(card, locale)} · {card.pronunciation}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-6">
            <section className="flex flex-col gap-3" aria-labelledby={`${titleId}-examples`}>
              <div className="flex items-center gap-2">
                <BookOpenText className="size-5 text-foreground-secondary" aria-hidden="true" />
                <h3 id={`${titleId}-examples`} className="text-base font-semibold text-foreground">
                  {t("cards.examples")}
                </h3>
              </div>
              <div className="flex flex-col gap-3">
                {card.examples.map((example) => {
                  const exampleTranslation = getCardExampleTranslation(example, locale);

                  return (
                    <article key={example.id} className="rounded-lg border border-border bg-background p-4">
                      <Badge className="border-transparent bg-background-card text-foreground-secondary">
                        {getExampleContextLabel(example.context, locale)}
                      </Badge>
                      <p className="mt-3 text-sm font-semibold leading-6 text-foreground">{example.sentence}</p>
                      {exampleTranslation ? (
                        <p className="mt-2 text-sm leading-6 text-foreground-secondary">{exampleTranslation}</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

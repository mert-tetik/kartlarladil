"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { TIER_REQUIREMENTS } from "@/data/tiers";
import { cn } from "@/lib/utils";
import { canUseSuperWater, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import type { VocabularyCard } from "@/types/domain";

export function AchievementCardSection({
  title,
  cards,
  tone,
  progressByCardId,
  reveal,
  exiting,
  staggerOffsetMs,
}: {
  title: string;
  cards: readonly VocabularyCard[];
  tone: "learned" | "advanced";
  progressByCardId?: Readonly<Record<string, number>>;
  reveal: boolean;
  exiting: boolean;
  staggerOffsetMs: number;
}) {
  const { locale } = useLocale();
  const [faceDownCardIds, setFaceDownCardIds] = useState<Set<string>>(() => new Set());
  const cardIdKey = cards.map((card) => card.id).join("|");

  useEffect(() => {
    if (!reveal || exiting || typeof window === "undefined") return;

    const timers = Array.from({ length: cards.length }, (_, index) => window.setTimeout(
      () => playSoundEffect("result-card-reveal"),
      staggerOffsetMs + 150 + index * 55,
    ));

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [cardIdKey, cards.length, exiting, reveal, staggerOffsetMs]);

  const handleCardClick = (cardId: string) => {
    vibrate("flip");
    setFaceDownCardIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl p-3 sm:p-4"
      style={{ "--result-stagger-delay": `${staggerOffsetMs}ms` } as CSSProperties}
      data-chest-achievement-section={tone}
      data-quiz-achievement-section={tone}
    >
      <h2
        className={cn(
          "text-center text-3xl font-bold uppercase sm:text-4xl",
          exiting ? "result-stagger-exit" : reveal ? "result-stagger-enter" : "result-stagger-pending",
          canUseSuperWater(locale) && "font-super-water",
          tone === "learned" ? "text-sky-400" : "text-emerald-400",
        )}
        style={{ "--result-stagger-delay": `${staggerOffsetMs + 80}ms` } as CSSProperties}
      >
        {formatSuperWaterUppercaseText(locale, title)}
      </h2>
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 lg:grid-cols-6">
        {cards.map((card, index) => (
          <div
            key={`${tone}-${card.id}`}
            className={cn(
              "relative aspect-[5/6] min-w-0",
              exiting ? "result-stagger-exit" : reveal ? "result-stagger-enter" : "result-stagger-pending",
            )}
            style={{
              "--result-stagger-delay": `${staggerOffsetMs + 150 + index * 55}ms`,
            } as CSSProperties}
          >
            <VocabularyCardView
              card={card}
              face={faceDownCardIds.has(card.id) ? "back" : "front"}
              onClick={() => handleCardClick(card.id)}
              compact
              owned={false}
              showActions={false}
              footerMode="empty"
              frontMinimal
              frontFit
              primaryTranslationOnly
              memoryGame
              summaryCard
              summaryProgressCount={
                tone === "advanced"
                  ? progressByCardId?.[card.id] ?? Math.max(1, TIER_REQUIREMENTS[card.tier] - 1)
                  : undefined
              }
              className="h-full min-h-0 w-full"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

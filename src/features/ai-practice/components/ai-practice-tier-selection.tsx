"use client";

import Link from "next/link";
import { Crown, Leaf, Mountain, Sprout, TreePine } from "lucide-react";
import { TIERS, TIER_STYLES } from "@/data/tiers";
import { getTierLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import type { LanguageCode, Tier } from "@/types/domain";

const TIER_ICONS: Record<Tier, typeof Sprout> = {
  A1: Sprout,
  A2: Leaf,
  B1: TreePine,
  B2: Mountain,
  C1: Crown,
};

export function AiPracticeTierSelection({ language }: { language: LanguageCode }) {
  const t = useT();
  const { locale } = useLocale();

  return (
    <div className="relative w-full">
      <div className="flex flex-col items-center justify-center gap-6 pt-6">
        <h1 className="text-center font-display text-3xl font-semibold text-foreground">
          {t("page.aiPractice.tierSelectionTitle")}
        </h1>

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {TIERS.map((tier) => {
            const Icon = TIER_ICONS[tier];
            const tierAccent = TIER_STYLES[tier].accent;

            return (
              <Link
                key={tier}
                href={`/ai-practice/${language}/character?tier=${tier}`}
                className={`group flex flex-col items-center justify-center gap-2 rounded-lg p-4 text-white shadow-sm transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${tierAccent}`}
              >
                <Icon className="size-7 text-white" aria-hidden="true" />
                <span className="text-center text-sm font-semibold text-white">{tier}</span>
                <span className="text-center text-xs font-semibold text-white/90">
                  {getTierLabel(tier, locale)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

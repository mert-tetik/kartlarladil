"use client";

import Link from "next/link";
import { ArrowLeft, Crown, Leaf, Mountain, Sprout, TreePine } from "lucide-react";
import { TIERS } from "@/data/tiers";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-foreground">
          {t("page.aiPractice.tierSelectionTitle")}
        </h1>
        <Link
          href="/ai-practice"
          aria-label={t("common.back")}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background-card text-foreground transition-colors hover:bg-background-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {TIERS.map((tier) => {
          const Icon = TIER_ICONS[tier];

          return (
            <Link
              key={tier}
              href={`/ai-practice/${language}/character?tier=${tier}`}
              className="group flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              <Icon
                className="size-7 text-foreground-secondary transition-colors group-hover:text-foreground"
                aria-hidden="true"
              />
              <span className="text-center text-sm font-semibold text-foreground">{tier}</span>
              <span className="text-center text-xs font-semibold text-foreground-muted">
                {getTierLabel(tier, locale)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

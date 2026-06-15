"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, GraduationCap } from "lucide-react";
import { LANGUAGES } from "@/data/languages";
import { InventoryCardGrid } from "@/features/cards/components/card-grid";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { EmptyState } from "@/components/empty-state";
import { LanguageFlag } from "@/components/language-flag";
import { buttonClassName } from "@/components/ui/button";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/domain";

export function InventoryDashboard({ learnedOnly = false }: { learnedOnly?: boolean } = {}) {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudError = useInventoryStore((state) => state.cloudError);
  const { locale } = useLocale();
  const t = useT();

  const languageStats = useMemo(
    () =>
      LANGUAGES.map((item) => ({
        ...item,
        count: filterInventoryCards({ cards, language: item.code, status: learnedOnly ? "learned" : "all" }).length,
      })).filter((item) => item.count > 0),
    [cards, learnedOnly],
  );

  const activeLanguage = languageStats.some((item) => item.code === language)
    ? language
    : languageStats[0]?.code;

  const activeCards = useMemo(
    () => (activeLanguage ? filterInventoryCards({ cards, language: activeLanguage, status: "active" }) : []),
    [activeLanguage, cards],
  );

  const learnedCards = useMemo(
    () => (activeLanguage ? filterInventoryCards({ cards, language: activeLanguage, status: "learned" }) : []),
    [activeLanguage, cards],
  );

  if (!hydrated) {
    return <EmptyState icon={Boxes} title={t("inventory.loadingTitle")} description={t("inventory.loadingDescription")} />;
  }

  if (languageStats.length === 0) {
    return (
      <EmptyState
        icon={Boxes}
        title={t(learnedOnly ? "inventory.emptyAnyLearnedTitle" : "inventory.emptyAnyTitle")}
        description={t("inventory.emptyAnyDescription")}
        action={
          <Link href="/card-draw" className={buttonClassName("primary", "md")}>
            {t("nav.cardDraw")}
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {cloudError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {cloudError}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {languageStats.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => setLanguage(item.code)}
              className={cn(
                "rounded-md border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:bg-white",
                activeLanguage === item.code && "border-slate-950 bg-white",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                <LanguageFlag code={item.code} />
                {getLanguageDisplayName(item.code, locale)}
              </span>
              <span className="mt-2 block text-2xl font-bold text-slate-950">{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {!learnedOnly ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">{t("inventory.status.active")}</h2>
            {activeCards.length > 0 ? (
              <Link href="/learn" className={buttonClassName("primary", "sm")}>
                <GraduationCap className="size-4" aria-hidden="true" />
                {t("inventory.learn")}
              </Link>
            ) : null}
          </div>
          {activeCards.length > 0 ? (
            <InventoryCardGrid cards={activeCards} />
          ) : (
            <p className="text-sm text-slate-500">{t("inventory.emptyActiveDescription")}</p>
          )}
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-950">{t("inventory.status.learned")}</h2>
        {learnedCards.length > 0 ? (
          <InventoryCardGrid cards={learnedCards} />
        ) : (
          <p className="text-sm text-slate-500">{t("inventory.emptyLearnedDescription")}</p>
        )}
      </section>
    </div>
  );
}

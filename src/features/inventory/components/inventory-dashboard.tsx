"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, RotateCcw } from "lucide-react";
import { LANGUAGES } from "@/data/languages";
import { InventoryCardGrid } from "@/features/cards/components/card-grid";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { EmptyState } from "@/components/empty-state";
import { LanguageFlag } from "@/components/language-flag";
import { Button, buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCards, getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { CardStatus, LanguageCode } from "@/types/domain";

export function InventoryDashboard({ learnedOnly = false }: { learnedOnly?: boolean }) {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [status, setStatus] = useState<CardStatus | "all">(learnedOnly ? "learned" : "all");
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudError = useInventoryStore((state) => state.cloudError);
  const reset = useInventoryStore((state) => state.reset);
  const requireAuthAction = useRequireAuthAction();
  const { locale } = useLocale();
  const t = useT();

  const visibleCards = useMemo(
    () =>
      filterInventoryCards({
        cards,
        language,
        status: learnedOnly ? "learned" : status,
      }),
    [cards, language, learnedOnly, status],
  );

  const languageStats = useMemo(
    () =>
      LANGUAGES.map((item) => ({
        ...item,
        count: filterInventoryCards({ cards, language: item.code, status: learnedOnly ? "learned" : "all" }).length,
      })),
    [cards, learnedOnly],
  );

  if (!hydrated) {
    return <EmptyState icon={Boxes} title={t("inventory.loadingTitle")} description={t("inventory.loadingDescription")} />;
  }

  return (
    <div className="space-y-6">
      {cloudError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {cloudError}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-2 sm:grid-cols-3">
            {languageStats.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setLanguage(item.code)}
                className={cn(
                  "rounded-md border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:bg-white",
                  language === item.code && "border-slate-950 bg-white",
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

          <div className="flex flex-wrap gap-2">
            {!learnedOnly ? (
              <>
                {(["all", "active", "learned"] as const).map((item) => (
                  <Button
                    key={item}
                    variant={status === item ? "primary" : "secondary"}
                    onClick={() => setStatus(item)}
                  >
                    {item === "all"
                      ? t("common.all")
                      : item === "active"
                        ? t("inventory.status.active")
                        : t("inventory.status.learned")}
                  </Button>
                ))}
              </>
            ) : null}
            <Button variant="ghost" onClick={() => requireAuthAction(reset)}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {t("common.reset")}
            </Button>
          </div>
        </div>
      </div>

      {visibleCards.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <Badge>{formatCards(locale, visibleCards.length)}</Badge>
            {learnedOnly ? (
              <Link href="/learned#practice" className={buttonClassName("secondary", "sm")}>
                {t("inventory.repeatPractice")}
              </Link>
            ) : null}
          </div>
          <InventoryCardGrid cards={visibleCards} />
        </>
      ) : (
        <EmptyState
          icon={Boxes}
          title={learnedOnly ? t("inventory.emptyLearnedTitle") : t("inventory.emptyTitle")}
          description={t("inventory.emptyDescription")}
          action={
            <Link href="/card-draw" className={buttonClassName("primary", "md")}>
              {t("nav.cardDraw")}
            </Link>
          }
        />
      )}
    </div>
  );
}

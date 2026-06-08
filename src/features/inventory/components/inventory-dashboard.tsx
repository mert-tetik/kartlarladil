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
import { Button, buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    return <EmptyState icon={Boxes} title="Envanter hazırlanıyor" description="Kartların tarayıcı belleğinden okunuyor." />;
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
                <span className="text-sm font-semibold text-slate-950">{item.name}</span>
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
                    {item === "all" ? "Tümü" : item === "active" ? "Öğreniliyor" : "Öğrenildi"}
                  </Button>
                ))}
              </>
            ) : null}
            <Button variant="ghost" onClick={() => requireAuthAction(reset)}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Sıfırla
            </Button>
          </div>
        </div>
      </div>

      {visibleCards.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <Badge>{visibleCards.length} kart</Badge>
            {learnedOnly ? (
              <Link href="/ogrenilenler#alistirma" className={buttonClassName("secondary", "sm")}>
                Tekrar alıştırması
              </Link>
            ) : null}
          </div>
          <InventoryCardGrid cards={visibleCards} />
        </>
      ) : (
        <EmptyState
          icon={Boxes}
          title={learnedOnly ? "Bu dilde öğrenilmiş kart yok" : "Bu dilde kart yok"}
          description="Keşfet ekranından kart çekerek envanterini büyütmeye başlayabilirsin."
          action={
            <Link href="/kesfet" className={buttonClassName("primary", "md")}>
              Kart keşfet
            </Link>
          }
        />
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap, X, ChevronDown } from "lucide-react";
import { LANGUAGES } from "@/data/languages";
import { TIERS, TIER_STYLES } from "@/data/tiers";
import { InventoryCardGrid } from "@/features/cards/components/card-grid";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { EmptyState } from "@/components/empty-state";
import { LanguageFlag } from "@/components/language-flag";
import { buttonClassName } from "@/components/ui/button";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { InventoryCardView } from "@/features/inventory/inventory-selectors";
import type { LanguageCode } from "@/types/domain";

export function InventoryDashboard({
  learnedOnly = false,
}: { learnedOnly?: boolean } = {}) {
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [mobileMenu, setMobileMenu] = useState<"active" | "learned" | null>(null);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudError = useInventoryStore((state) => state.cloudError);
  const { locale } = useLocale();
  const t = useT();

  const languageStats = useMemo(
    () =>
      LANGUAGES.map((item) => ({
        ...item,
        count: filterInventoryCards({
          cards,
          language: item.code,
          status: learnedOnly ? "learned" : "all",
        }).length,
      })).filter((item) => item.count > 0),
    [cards, learnedOnly],
  );

  const activeLanguage = languageStats.some((item) => item.code === language)
    ? language
    : languageStats[0]?.code;

  const activeCards = useMemo(
    () =>
      activeLanguage
        ? filterInventoryCards({
            cards,
            language: activeLanguage,
            status: "active",
          })
        : [],
    [activeLanguage, cards],
  );

  const learnedCards = useMemo(
    () =>
      activeLanguage
        ? filterInventoryCards({
            cards,
            language: activeLanguage,
            status: "learned",
          })
        : [],
    [activeLanguage, cards],
  );

  const tierCounts = useMemo(() => {
    const counts: Record<"active" | "learned", Record<string, number>> = {
      active: {},
      learned: {},
    };

    for (const tier of TIERS) {
      counts.active[tier] = activeCards.filter(({ card }) => card.tier === tier).length;
      counts.learned[tier] = learnedCards.filter(({ card }) => card.tier === tier).length;
    }

    return counts;
  }, [activeCards, learnedCards]);

  if (!hydrated) {
    return (
      <EmptyState
        title={t("inventory.loadingTitle")}
        description={t("inventory.loadingDescription")}
      />
    );
  }

  if (languageStats.length === 0) {
    return (
      <EmptyState
        title={t(
          learnedOnly
            ? "inventory.emptyAnyLearnedTitle"
            : "inventory.emptyAnyTitle",
        )}
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
    <div className="max-lg:flex-1 max-lg:overflow-hidden lg:space-y-6">
      {cloudError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {cloudError}
        </div>
      ) : null}

      <div className="hidden lg:block">
        <div className="rounded-lg border border-border bg-background-card p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {languageStats.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setLanguage(item.code)}
                className={cn(
                  "rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-background-card",
                  activeLanguage === item.code && "border-foreground bg-background-card",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <LanguageFlag code={item.code} className="h-5 w-7" />
                  {getLanguageDisplayName(item.code, locale)}
                </span>
                <span className="mt-2 block text-2xl font-bold text-foreground">
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        {!learnedOnly ? (
          <section className="space-y-4">
            <div className="flex w-full items-center justify-between bg-black px-4 py-3 text-white">
              <h2 className="text-lg font-semibold text-white">
                {t("inventory.status.active")}
              </h2>
              {activeCards.length > 0 ? (
                <Link href="/learn" className={buttonClassName("primary", "sm")}>
                  <GraduationCap className="size-4" aria-hidden="true" />
                  {t("inventory.learn")}
                </Link>
              ) : null}
            </div>
            {activeCards.length > 0 ? (
              <InventoryCardGrid cards={activeCards} flippable />
            ) : (
              <p className="text-sm text-foreground-muted">
                {t("inventory.emptyActiveDescription")}
              </p>
            )}
          </section>
        ) : null}

        <section className="mt-8 space-y-4">
          <div className="w-full bg-black px-4 py-3">
            <h2 className="text-lg font-semibold text-white">
              {t("inventory.status.learned")}
            </h2>
          </div>
          {learnedCards.length > 0 ? (
            <InventoryCardGrid cards={learnedCards} flippable />
          ) : (
            <p className="text-sm text-foreground-muted">
              {t("inventory.emptyLearnedDescription")}
            </p>
          )}
        </section>
      </div>

      <div className="flex h-full flex-col gap-4 lg:hidden">
        <MobileLanguageSelector
          languages={languageStats}
          activeLanguage={activeLanguage}
          onSelect={(code) => {
            setLanguage(code);
            setLanguageMenuOpen(false);
          }}
          isOpen={languageMenuOpen}
          onToggle={() => setLanguageMenuOpen((current) => !current)}
          onClose={() => setLanguageMenuOpen(false)}
        />

        {!learnedOnly ? (
          <MobileSectionBlock
            title={t("inventory.status.active")}
            count={activeCards.length}
            tierCounts={tierCounts.active}
            action={
              activeCards.length > 0 ? (
                <Link href="/learn" className={buttonClassName("primary", "sm")}>
                  <GraduationCap className="size-4" aria-hidden="true" />
                  {t("inventory.learn")}
                </Link>
              ) : null
            }
            onView={() => setMobileMenu("active")}
          />
        ) : null}

        <MobileSectionBlock
          title={t("inventory.status.learned")}
          count={learnedCards.length}
          tierCounts={tierCounts.learned}
          onView={() => setMobileMenu("learned")}
        />
      </div>

      {mobileMenu ? (
        <MobileCardMenu
          title={
            mobileMenu === "active"
              ? t("inventory.status.active")
              : t("inventory.status.learned")
          }
          cards={mobileMenu === "active" ? activeCards : learnedCards}
          onClose={() => setMobileMenu(null)}
        />
      ) : null}
    </div>
  );
}

function MobileLanguageSelector({
  languages,
  activeLanguage,
  onSelect,
  isOpen,
  onToggle,
  onClose,
}: {
  languages: Array<{ code: LanguageCode; count: number }>;
  activeLanguage?: LanguageCode;
  onSelect: (code: LanguageCode) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const active = languages.find((item) => item.code === activeLanguage) ?? languages[0];

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-background-card px-4 py-3 text-left"
      >
        <span className="flex items-center gap-3 text-sm font-semibold text-foreground">
          <LanguageFlag code={active?.code ?? "en"} className="h-6 w-9" />
          {active ? getLanguageDisplayName(active.code, locale) : "-"}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 shrink-0 text-foreground-muted transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-background-card px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">{t("inventory.selectLanguage")}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="inline-flex size-9 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-4">
              {languages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => onSelect(item.code)}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-lg border border-border bg-background-card p-4 transition-colors",
                    activeLanguage === item.code
                      ? "border-foreground bg-background-muted"
                      : "hover:bg-background-muted",
                  )}
                >
                  <LanguageFlag code={item.code} className="h-20 w-32" />
                  <span className="text-center text-sm font-semibold text-foreground">
                    {getLanguageDisplayName(item.code, locale)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MobileSectionBlock({
  title,
  count,
  tierCounts,
  action,
  onView,
}: {
  title: string;
  count: number;
  tierCounts: Record<string, number>;
  action?: React.ReactNode;
  onView: () => void;
}) {
  const t = useT();

  return (
    <button
      type="button"
      onClick={onView}
      className="flex w-full flex-col gap-4 rounded-lg border border-border bg-background-card p-4 text-left transition-colors hover:bg-background-muted"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-foreground-muted">
            {t("common.cardsWithCount", { count })}
          </p>
        </div>
        {action ? <div onClick={(event) => event.stopPropagation()}>{action}</div> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TIERS.map((tier) => {
          const style = TIER_STYLES[tier];
          const tierCount = tierCounts[tier] ?? 0;

          return (
            <div
              key={tier}
              className={cn(
                "flex h-16 w-12 flex-col items-center justify-center rounded-md border text-xs font-bold",
                style.surface,
                style.border,
                style.text,
              )}
            >
              <span>{tier}</span>
              <span className="text-sm">{tierCount}</span>
            </div>
          );
        })}
      </div>

      <span className="self-start rounded-md bg-background px-3 py-1.5 text-xs font-semibold text-foreground-secondary">
        {t("inventory.viewCards")}
      </span>
    </button>
  );
}

function MobileCardMenu({
  title,
  cards,
  onClose,
}: {
  title: string;
  cards: InventoryCardView[];
  onClose: () => void;
}) {
  const t = useT();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-background-card px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="inline-flex size-9 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {cards.length > 0 ? (
          <InventoryCardGrid cards={cards} flippable />
        ) : (
          <p className="text-sm text-foreground-muted">{t("inventory.emptyActiveDescription")}</p>
        )}
      </div>
    </div>
  );
}

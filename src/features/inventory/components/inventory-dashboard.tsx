"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, CheckCircle2, GraduationCap, X } from "lucide-react";
import { LANGUAGES } from "@/data/languages";
import { TIERS, TIER_STYLES } from "@/data/tiers";
import { InventoryCardGrid } from "@/features/cards/components/card-grid";
import { SelectDropdown } from "@/features/cards/components/filter-controls";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { EmptyState } from "@/components/empty-state";
import { LanguageFlag } from "@/components/language-flag";
import { buttonClassName } from "@/components/ui/button";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { InventoryCardView } from "@/features/inventory/inventory-selectors";
import type { CardStatus, LanguageCode, Tier } from "@/types/domain";

export function InventoryDashboard({
  learnedOnly = false,
  mobileSheet = false,
}: { learnedOnly?: boolean; mobileSheet?: boolean } = {}) {
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

  const languageOptions = LANGUAGES.filter((item) => languageStats.some((stat) => stat.code === item.code)).map(
    (item) => ({
      value: item.code,
      label: getLanguageDisplayName(item.code, locale),
      icon: <LanguageFlag code={item.code} className="h-5 w-7" />,
    }),
  );

  return (
    <>
      {mobileSheet ? (
        <MobileInventorySheet
          language={activeLanguage}
          languageOptions={languageOptions}
          onLanguageChange={setLanguage}
          activeCards={activeCards}
          learnedCards={learnedCards}
          cloudError={cloudError}
        />
      ) : null}

      <div className={cn("space-y-6", mobileSheet && "max-lg:hidden")}>
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
                  <LanguageFlag code={item.code} className="h-5 w-7" />
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
    </>
  );
}

function MobileInventorySheet({
  language,
  languageOptions,
  onLanguageChange,
  activeCards,
  learnedCards,
  cloudError,
}: {
  language: LanguageCode | undefined;
  languageOptions: { value: string; label: string; icon: React.ReactNode }[];
  onLanguageChange: (language: LanguageCode) => void;
  activeCards: InventoryCardView[];
  learnedCards: InventoryCardView[];
  cloudError: string;
}) {
  const [openStatus, setOpenStatus] = useState<CardStatus | null>(null);
  const t = useT();

  return (
    <div className="max-lg:fixed max-lg:inset-x-0 max-lg:top-16 max-lg:bottom-16 max-lg:flex max-lg:flex-col max-lg:bg-slate-50 lg:hidden">
      <div className="max-lg:shrink-0 max-lg:px-4 max-lg:pt-4">
        <h2 className="font-display text-2xl font-semibold text-slate-950">{t("page.inventory.title")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("page.inventory.description")}</p>
        <div className="mt-4">
          {language ? (
            <SelectDropdown
              label={t("cards.language")}
              options={languageOptions}
              value={language}
              onChange={(value) => onLanguageChange(value as LanguageCode)}
            />
          ) : null}
        </div>
      </div>

      <div className="max-lg:flex-1 max-lg:overflow-y-auto max-lg:px-4 max-lg:py-4">
        {cloudError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            {cloudError}
          </div>
        ) : null}

        <div className="space-y-3">
          <StatusButton
            status="active"
            count={activeCards.length}
            cards={activeCards}
            icon={GraduationCap}
            onClick={() => setOpenStatus("active")}
          />
          <StatusButton
            status="learned"
            count={learnedCards.length}
            cards={learnedCards}
            icon={CheckCircle2}
            onClick={() => setOpenStatus("learned")}
          />
        </div>
      </div>

      {openStatus ? (
        <StatusSheet
          status={openStatus}
          cards={openStatus === "active" ? activeCards : learnedCards}
          onClose={() => setOpenStatus(null)}
        />
      ) : null}
    </div>
  );
}

function StatusButton({
  status,
  count,
  cards,
  icon: Icon,
  onClick,
}: {
  status: CardStatus;
  count: number;
  cards: InventoryCardView[];
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  const t = useT();
  const tierCounts = useMemo(() => {
    const counts: Record<Tier, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0 };
    for (const { card } of cards) {
      counts[card.tier] += 1;
    }
    return counts;
  }, [cards]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex w-full items-center justify-between overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all active:scale-[0.99]"
    >
      <div className="relative z-10 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-950">
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-950">{t(`inventory.status.${status}`)}</p>
            <p className="text-xs font-semibold text-slate-500">{t("common.cardsWithCount", { count })}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
          {TIERS.map((tier) =>
            tierCounts[tier] > 0 ? (
              <span key={tier} className={cn("flex items-center gap-1", TIER_STYLES[tier].text)}>
                <span className={cn("size-1.5 rounded-full", TIER_STYLES[tier].accent)} aria-hidden="true" />
                {tier} {tierCounts[tier]}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <CardStackDecoration />
    </button>
  );
}

function CardStackDecoration() {
  return (
    <div className="relative z-0 h-20 w-24 shrink-0">
      <div className="absolute inset-0 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 shadow-sm [transform:translate(-10%,-2%)_rotate(-12deg)]" />
      <div className="absolute inset-0 rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 shadow-sm [transform:rotate(-6deg)]" />
      <div className="absolute inset-0 rounded-lg border border-slate-200 bg-white shadow-sm [transform:translate(6%,2%)_rotate(6deg)]" />
    </div>
  );
}

function StatusSheet({
  status,
  cards,
  onClose,
}: {
  status: CardStatus;
  cards: InventoryCardView[];
  onClose: () => void;
}) {
  const t = useT();

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h3 className="font-display text-xl font-semibold text-slate-950">{t(`inventory.status.${status}`)}</h3>
        <button
          type="button"
          onClick={onClose}
          className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-slate-950 transition-colors hover:bg-slate-200"
          aria-label={t("common.close")}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {cards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cards.map(({ card, inventory }) => (
              <VocabularyCardView
                key={card.id}
                card={card}
                inventory={inventory}
                owned
                flippable={false}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {t(status === "active" ? "inventory.emptyActiveDescription" : "inventory.emptyLearnedDescription")}
          </p>
        )}
      </div>
    </div>
  );
}

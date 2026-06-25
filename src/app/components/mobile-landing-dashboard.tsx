"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Info, RotateCcw } from "lucide-react";
import { LANGUAGES } from "@/data/languages";
import { TIERS, TIER_STYLES } from "@/data/tiers";
import { CardsIcon } from "@/components/icons/cards-icon";
import { LanguageFlag } from "@/components/language-flag";
import { Button } from "@/components/ui/button";
import { MobileLanguageBottomSheet } from "@/app/components/mobile-language-bottom-sheet";
import { MobileTierSelector } from "@/app/components/mobile-tier-selector";
import { MobileLandingInfoSheet } from "@/app/components/mobile-landing-info-sheet";
import { useAuthSession, useRequireAuthAction } from "@/features/auth/auth-client";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useProgressStats } from "@/features/progress/progress-client";
import { formatNumber, getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/use-is-client";
import { vibrate } from "@/lib/vibration";
import type { LanguageCode, Tier } from "@/types/domain";

export function MobileLandingDashboard() {
  const router = useRouter();
  const { user } = useAuthSession();
  const { stats } = useProgressStats();
  const { locale } = useLocale();
  const t = useT();
  const requireAuthAction = useRequireAuthAction();
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);

  const defaultLanguage = useMemo<LanguageCode>(() => {
    const preferred = user?.profile.preferredLanguageCode;
    if (preferred && LANGUAGES.some((item) => item.code === preferred)) {
      return preferred;
    }
    if (LANGUAGES.some((item) => item.code === locale)) {
      return locale;
    }
    return "en";
  }, [user?.profile.preferredLanguageCode, locale]);

  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(defaultLanguage);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [tierSelectorOpen, setTierSelectorOpen] = useState(false);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [selectedDetailTier, setSelectedDetailTier] = useState<Tier | "all">("all");
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [detailMenuStatus, setDetailMenuStatus] = useState<"active" | "learned">("active");

  const languageStats = useMemo(
    () =>
      LANGUAGES.map((item) => ({
        ...item,
        count: filterInventoryCards({
          cards,
          language: item.code,
          status: "all",
        }).length,
      })).filter((item) => item.count > 0),
    [cards],
  );

  const activeForLanguage = useMemo(
    () =>
      filterInventoryCards({
        cards,
        language: selectedLanguage,
        status: "active",
      }),
    [cards, selectedLanguage],
  );

  const learnedForLanguage = useMemo(
    () =>
      filterInventoryCards({
        cards,
        language: selectedLanguage,
        status: "learned",
      }),
    [cards, selectedLanguage],
  );

  const activeCount = activeForLanguage.length;
  const learnedCount = learnedForLanguage.length;

  const tierCounts = useMemo(() => {
    const counts: Record<Tier, { active: number; learned: number }> = {
      A1: { active: 0, learned: 0 },
      A2: { active: 0, learned: 0 },
      B1: { active: 0, learned: 0 },
      B2: { active: 0, learned: 0 },
      C1: { active: 0, learned: 0 },
    };

    for (const item of activeForLanguage) {
      counts[item.card.tier].active += 1;
    }
    for (const item of learnedForLanguage) {
      counts[item.card.tier].learned += 1;
    }

    return counts;
  }, [activeForLanguage, learnedForLanguage]);

  function handleDrawCards() {
    vibrate("tap");
    requireAuthAction(() => {
      setTierSelectorOpen(true);
    }, { nextPath: "/card-draw" });
  }

  function handleStartLearning() {
    vibrate("tap");
    const nextPath = `/learn?mode=active&language=${encodeURIComponent(selectedLanguage)}`;
    requireAuthAction(() => {
      if (activeCount === 0) return;
      router.push(nextPath);
    }, { nextPath });
  }

  function handleRepeatLearned() {
    vibrate("tap");
    const nextPath = `/learn?mode=learned&language=${encodeURIComponent(selectedLanguage)}`;
    requireAuthAction(() => {
      if (learnedCount === 0) return;
      router.push(nextPath);
    }, { nextPath });
  }

  function openDetailMenu(status: "active" | "learned") {
    vibrate("tap");
    setDetailMenuStatus(status);
    setSelectedDetailTier("all");
    setDetailMenuOpen(true);
  }

  const isClient = useIsClient();

  if (!hydrated || !isClient) {
    return (
      <div className="flex h-full items-center justify-center lg:hidden">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground-muted border-t-brand" />
      </div>
    );
  }

  return (
    <section className="relative flex h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] flex-col overflow-hidden bg-background p-4 lg:hidden">
      {/* Info icon */}
      <button
        type="button"
        onClick={() => {
          vibrate("tap");
          setInfoSheetOpen(true);
        }}
        className="absolute right-4 top-4 z-10 inline-flex size-10 items-center justify-center rounded-full bg-background-card text-foreground-secondary shadow-sm transition-colors hover:text-foreground"
        aria-label={t("home.mobile.infoTitle")}
      >
        <Info className="size-5" aria-hidden="true" />
      </button>

      {/* Rank */}
      <div className="flex flex-col items-center pt-2">
        <span className="text-xs font-bold uppercase tracking-widest text-foreground-muted">
          {t("home.mobile.rankLabel")}
        </span>
        <h1 className="mt-1 text-center text-3xl font-extrabold text-brand">
          {stats.rank.label}
        </h1>
        <p className="mt-1 text-sm font-semibold text-foreground-secondary">
          {formatNumber(locale, stats.totalPoints)} {t("home.mobile.pointsLabel")}
        </p>
      </div>

      {/* Language selector */}
      <button
        type="button"
        onClick={() => {
          vibrate("tap");
          setLanguageSheetOpen(true);
        }}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-border bg-background-card px-4 py-3 text-left transition-colors hover:bg-background-muted"
      >
        <span className="flex items-center gap-3">
          <LanguageFlag code={selectedLanguage} className="h-6 w-9" />
          <span className="text-base font-semibold text-foreground">
            {getLanguageDisplayName(selectedLanguage, locale)}
          </span>
        </span>
        <span className="text-xs font-semibold text-foreground-muted">
          {t("home.mobile.selectLanguage")}
        </span>
      </button>

      {/* Draw cards button */}
      <Button
        size="lg"
        onClick={handleDrawCards}
        className="mt-4 h-14 w-full gap-2 border-0 bg-brand text-lg font-bold text-brand-foreground shadow-lg hover:bg-brand-hover"
      >
        <CardsIcon className="size-6" aria-hidden="true" />
        {t("home.mobile.drawCards")}
      </Button>

      {/* Active / Learned row */}
      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-border">
        <StatusBlock
          title={t("home.mobile.activeCards")}
          count={activeCount}
          variant="active"
          onClick={() => openDetailMenu("active")}
        />
        <StatusBlock
          title={t("home.mobile.learnedCards")}
          count={learnedCount}
          variant="learned"
          onClick={() => openDetailMenu("learned")}
        />
      </div>

      {/* Tier breakdown */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {TIERS.map((tier) => {
          const style = TIER_STYLES[tier];
          const count = tierCounts[tier].active + tierCounts[tier].learned;

          return (
            <button
              key={tier}
              type="button"
              onClick={() => {
                vibrate("tap");
                setSelectedDetailTier(tier);
                setDetailMenuStatus("active");
                setDetailMenuOpen(true);
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border px-2 py-1 text-xs font-bold transition-transform active:scale-95",
                style.surface,
                style.border,
                style.text,
              )}
            >
              <span>{tier}</span>
              <span className="text-sm">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
      <div className="mt-4 flex flex-col gap-3 pb-2">
        <Button
          size="lg"
          onClick={handleStartLearning}
          disabled={activeCount === 0}
          className="h-14 w-full gap-2 border-0 bg-emerald-500 text-lg font-bold text-white shadow-lg hover:bg-emerald-600 disabled:opacity-50"
        >
          <GraduationCap className="size-6" aria-hidden="true" />
          {t("home.mobile.startLearning")}
        </Button>
        <Button
          size="lg"
          onClick={handleRepeatLearned}
          disabled={learnedCount === 0}
          className="h-14 w-full gap-2 border-0 bg-sky-500 text-lg font-bold text-white shadow-lg hover:bg-sky-600 disabled:opacity-50"
        >
          <RotateCcw className="size-6" aria-hidden="true" />
          {t("home.mobile.repeatLearned")}
        </Button>
      </div>

      {/* Sheets */}
      <MobileLanguageBottomSheet
        isOpen={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        options={languageStats.length > 0 ? languageStats : LANGUAGES.map((item) => ({ code: item.code, count: 0 }))}
        selectedLanguage={selectedLanguage}
        onSelect={setSelectedLanguage}
      />

      <MobileTierSelector
        isOpen={tierSelectorOpen}
        onClose={() => setTierSelectorOpen(false)}
        language={selectedLanguage}
      />

      <MobileLandingInfoSheet
        isOpen={infoSheetOpen}
        onClose={() => setInfoSheetOpen(false)}
      />

      <TierDetailMenu
        isOpen={detailMenuOpen}
        onClose={() => setDetailMenuOpen(false)}
        selectedTier={selectedDetailTier}
        onTierChange={setSelectedDetailTier}
        activeCards={activeForLanguage}
        learnedCards={learnedForLanguage}
        status={detailMenuStatus}
        onStatusChange={setDetailMenuStatus}
      />
    </section>
  );
}

function StatusBlock({
  title,
  count,
  variant,
  onClick,
}: {
  title: string;
  count: number;
  variant: "active" | "learned";
  onClick: () => void;
}) {
  const isActive = variant === "active";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center py-4 text-white transition-transform active:scale-[0.98]",
        isActive ? "bg-emerald-500" : "bg-sky-500",
      )}
    >
      <span className="text-sm font-semibold">{title}</span>
      <span className="mt-1 text-3xl font-extrabold">{count}</span>
    </button>
  );
}

function TierDetailMenu({
  isOpen,
  onClose,
  selectedTier,
  onTierChange,
  activeCards,
  learnedCards,
  status,
  onStatusChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedTier: Tier | "all";
  onTierChange: (tier: Tier | "all") => void;
  activeCards: ReturnType<typeof filterInventoryCards>;
  learnedCards: ReturnType<typeof filterInventoryCards>;
  status: "active" | "learned";
  onStatusChange: (status: "active" | "learned") => void;
}) {
  const { locale } = useLocale();
  const t = useT();

  const sourceCards = status === "active" ? activeCards : learnedCards;
  const filteredCards = selectedTier === "all"
    ? sourceCards
    : sourceCards.filter(({ card }) => card.tier === selectedTier);

  const tierCounts = useMemo(() => {
    const counts: Record<Tier | "all", number> = {
      all: sourceCards.length,
      A1: 0,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
    };

    for (const item of sourceCards) {
      counts[item.card.tier] += 1;
    }

    return counts;
  }, [sourceCards]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background transition-opacity duration-300 lg:hidden",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-background-card px-4 py-3">
        <div className="flex gap-1">
          {(["active", "learned"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onStatusChange(item)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                status === item
                  ? item === "active"
                    ? "bg-emerald-500 text-white"
                    : "bg-sky-500 text-white"
                  : "text-foreground-secondary hover:bg-background-muted",
              )}
            >
              {t(`home.mobile.${item}Cards`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-9 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
          aria-label={t("common.close")}
        >
          ×
        </button>
      </div>

      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-background-card px-4 py-3 scrollbar-hide">
        <FilterChip
          label={t("home.mobile.allTiers")}
          count={tierCounts.all}
          selected={selectedTier === "all"}
          onClick={() => onTierChange("all")}
        />
        {TIERS.map((tier) => {
          const style = TIER_STYLES[tier];
          return (
            <FilterChip
              key={tier}
              label={tier}
              count={tierCounts[tier]}
              selected={selectedTier === tier}
              onClick={() => onTierChange(tier)}
              className={cn(style.text, selectedTier === tier && "text-white")}
              selectedClassName={style.accent}
            />
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {filteredCards.length === 0 ? (
          <p className="py-8 text-center text-sm text-foreground-secondary">
            {t(status === "active" ? "inventory.emptyActiveDescription" : "quiz.noLearnedDescription")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredCards.map(({ card }) => (
              <Link
                key={card.id}
                href={`/ask/${card.language}?term=${encodeURIComponent(card.term)}`}
                onClick={onClose}
                className="rounded-xl border border-border bg-background-card p-3 transition-colors hover:bg-background-muted"
              >
                <p className="text-sm font-bold text-foreground">{card.term}</p>
                <p className="mt-1 text-xs text-foreground-secondary line-clamp-2">
                  {card.translations[locale] || card.translation}
                </p>
                <span
                  className={cn(
                    "mt-2 inline-flex rounded px-2 py-0.5 text-[10px] font-bold text-white",
                    TIER_STYLES[card.tier].accent,
                  )}
                >
                  {card.tier}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  selected,
  onClick,
  className,
  selectedClassName,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  className?: string;
  selectedClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
        selected
          ? cn("border-transparent bg-foreground text-background", selectedClassName)
          : cn("border-border bg-background text-foreground-secondary hover:bg-background-muted", className),
      )}
    >
      <span>{label}</span>
      <span className={cn("opacity-80", selected ? "text-background" : "")}>{count}</span>
    </button>
  );
}

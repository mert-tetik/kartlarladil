"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const LANDING_CARD_LANGUAGE_KEY = "foxiesdeck:landing-card-language";
import { GraduationCap, Info, RotateCcw, Trash2, X } from "lucide-react";
import { LANGUAGES } from "@/data/languages";
import { TIERS, TIER_STYLES } from "@/data/tiers";
import { CardsIcon } from "@/components/icons/cards-icon";
import { LanguageFlag } from "@/components/language-flag";
import { Button } from "@/components/ui/button";
import { MobileLanguageBottomSheet } from "@/app/components/mobile-language-bottom-sheet";
import { MobileTierSelector } from "@/app/components/mobile-tier-selector";
import { MobileLandingInfoSheet } from "@/app/components/mobile-landing-info-sheet";
import { MobileRankInfoSheet } from "@/app/components/mobile-rank-info-sheet";
import { MobileLockedActionSheet } from "@/app/components/mobile-locked-action-sheet";
import { MobileCardDisplaySheet } from "@/app/components/mobile-card-display-sheet";
import { useAuthSession, useRequireAuthAction } from "@/features/auth/auth-client";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useProgressStats } from "@/features/progress/progress-client";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { RANK_ICON_ASSETS } from "@/features/progress/rank-icons";
import { formatNumber, getLanguageDisplayName, getRankLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { useDetectedLocale } from "@/i18n/use-detected-locale";
import { cn } from "@/lib/utils";
import {
  resolveCardLanguageOnSiteLocaleChange,
  resolveMobileLandingLanguage,
} from "@/app/components/mobile-landing-language-guard";

import { vibrate } from "@/lib/vibration";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

export function MobileLandingDashboard() {
  const router = useRouter();
  const { user } = useAuthSession();
  const { stats } = useProgressStats();
  const { locale, setLocale } = useLocale();
  const detectedLocale = useDetectedLocale();
  const t = useT();
  const requireAuthAction = useRequireAuthAction();
  const cards = useInventoryStore((state) => state.cards);

  const defaultLanguage = useMemo<LanguageCode>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(LANDING_CARD_LANGUAGE_KEY);
      if (stored && LANGUAGES.some((item) => item.code === stored)) {
        return stored as LanguageCode;
      }
    }

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

  useEffect(() => {
    if (selectedLanguage !== locale) {
      return;
    }

    const nextLanguage = resolveCardLanguageOnSiteLocaleChange(
      selectedLanguage,
      locale,
      detectedLocale,
    );

    if (nextLanguage === selectedLanguage) {
      return;
    }

    window.localStorage.setItem(LANDING_CARD_LANGUAGE_KEY, nextLanguage);
    const timeoutId = window.setTimeout(() => {
      setSelectedLanguage(nextLanguage);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [locale, selectedLanguage, detectedLocale]);

  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [tierSelectorOpen, setTierSelectorOpen] = useState(false);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [rankInfoOpen, setRankInfoOpen] = useState(false);
  const [lockedSheet, setLockedSheet] = useState<"active" | "learned" | null>(null);
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
      })),
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
      const tutorialState = useTutorialStore.getState();
      if (!tutorialState.completed && tutorialState.step === 0) {
        tutorialState.advance();
      }
      setTierSelectorOpen(true);
    }, { nextPath: "/card-draw" });
  }

  function handleStartLearning() {
    vibrate("tap");
    if (activeCount === 0) {
      setLockedSheet("active");
      return;
    }
    const nextPath = `/learn?mode=active&language=${encodeURIComponent(selectedLanguage)}`;
    requireAuthAction(() => {
      router.push(nextPath);
    }, { nextPath });
  }

  function handleRepeatLearned() {
    vibrate("tap");
    if (learnedCount === 0) {
      setLockedSheet("learned");
      return;
    }
    const nextPath = `/learn?mode=learned&language=${encodeURIComponent(selectedLanguage)}`;
    requireAuthAction(() => {
      router.push(nextPath);
    }, { nextPath });
  }

  function openDetailMenu(status: "active" | "learned") {
    vibrate("tap");
    setDetailMenuStatus(status);
    setSelectedDetailTier("all");
    setDetailMenuOpen(true);
  }

  function handleSelectLanguage(language: LanguageCode) {
    vibrate("tap");
    const resolved = resolveMobileLandingLanguage(language, locale, detectedLocale);
    const nextCardLanguage = resolved.cardLanguage;

    window.localStorage.setItem(LANDING_CARD_LANGUAGE_KEY, nextCardLanguage);

    if (resolved.siteLocale !== locale) {
      setLocale(resolved.siteLocale);
    }

    setSelectedLanguage(nextCardLanguage);
  }

  return (
    <section data-mobile-landing-dashboard className="relative flex h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] flex-col gap-2.5 overflow-hidden bg-background px-4 py-1 lg:hidden">
      {/* Info icon */}
      <button
        type="button"
        onClick={() => {
          vibrate("tap");
          setInfoSheetOpen(true);
        }}
        className="absolute right-2 top-2 z-10 inline-flex size-7 items-center justify-center rounded-full text-white transition-colors hover:text-white/80"
        aria-label={t("home.mobile.infoTitle")}
      >
        <Info className="size-5" aria-hidden="true" />
      </button>

      {/* Rank */}
      <div className="-mx-4 flex flex-1 min-h-[150px] max-h-[52vh] flex-col items-center gap-0.5 rounded-none bg-[#121212] px-4 pt-2 pb-1 text-white">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
          {t("home.mobile.rankLabel")}
        </span>
        <button
          type="button"
          onClick={() => {
            vibrate("tap");
            setRankInfoOpen(true);
          }}
          className="flex min-h-0 w-full flex-1 items-center justify-center self-stretch"
          aria-label={getRankLabel(stats.rank, locale)}
          data-rank-icon-button
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={RANK_ICON_ASSETS[stats.rank.icon]}
            alt=""
            className="max-h-full w-auto max-w-full object-contain"
            draggable={false}
          />
        </button>
        <h1 className="text-center text-lg font-extrabold text-brand">
          {getRankLabel(stats.rank, locale)}
        </h1>
        <p className="text-[10px] font-semibold text-white/80">
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
        className="flex w-full shrink-0 items-center justify-between rounded-xl border border-border bg-background-card px-4 py-1.5 text-left transition-colors hover:bg-background-muted"
      >
        <span className="flex items-center gap-3">
          <LanguageFlag code={selectedLanguage} className="h-6 w-9" />
          <span className="text-base font-semibold text-foreground">
            {getLanguageDisplayName(selectedLanguage, locale)}
          </span>
        </span>
        <span className="text-xs font-semibold text-foreground-muted">
          {t("home.mobile.cardLanguage")}
        </span>
      </button>

      {/* Draw cards button */}
      <Button
        size="lg"
        onClick={handleDrawCards}
        data-tutorial-target="landing-draw-cards"
        className="h-14 w-full shrink-0 gap-2 border-0 bg-brand text-base font-bold text-brand-foreground shadow-lg hover:bg-brand-hover"
      >
        <CardsIcon className="size-6" aria-hidden="true" />
        {t("home.mobile.drawCards")}
      </Button>

      {/* Active / Learned row */}
      <div className="grid shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-border">
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
      <div className="grid shrink-0 grid-cols-5 gap-2">
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
                "flex flex-col items-center justify-center rounded-md py-1 text-[10px] font-bold text-white shadow-sm transition-transform active:scale-95",
                style.accent,
              )}
            >
              <span>{tier}</span>
              <span className="text-xs">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 flex-col gap-3 pb-1">
        <ActionButton
          icon={GraduationCap}
          label={t("home.mobile.startLearning")}
          locked={activeCount === 0}
          onClick={handleStartLearning}
          variant="active"
          dataTutorialTarget="start-learning"
        />
        <ActionButton
          icon={RotateCcw}
          label={t("home.mobile.repeatLearned")}
          locked={learnedCount === 0}
          onClick={handleRepeatLearned}
          variant="learned"
        />
      </div>

      {/* Sheets */}
      <MobileLanguageBottomSheet
        isOpen={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        options={languageStats}
        selectedLanguage={selectedLanguage}
        onSelect={handleSelectLanguage}
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

      <MobileRankInfoSheet
        isOpen={rankInfoOpen}
        onClose={() => setRankInfoOpen(false)}
        rank={stats.rank}
        nextRank={stats.nextRank}
        totalPoints={stats.totalPoints}
        pointsToNextRank={stats.pointsToNextRank}
        rankProgressPercent={stats.rankProgressPercent}
      />

      <MobileLockedActionSheet
        isOpen={lockedSheet !== null}
        onClose={() => setLockedSheet(null)}
        variant={lockedSheet ?? "active"}
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
        "flex flex-col items-center justify-center py-2 text-white transition-transform active:scale-[0.98]",
        isActive ? "bg-emerald-500" : "bg-sky-500",
      )}
    >
      <span className="text-xs font-semibold">{title}</span>
      <span className="mt-0.5 text-2xl font-extrabold">{count}</span>
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
  const removeCard = useInventoryStore((state) => state.removeCard);
  const [displayCard, setDisplayCard] = useState<VocabularyCard | null>(null);

  function handleDeleteCard(cardId: string) {
    if (typeof window !== "undefined" && !window.confirm(t("inventory.deleteConfirm"))) {
      return;
    }

    if (displayCard?.id === cardId) {
      setDisplayCard(null);
    }

    void removeCard(cardId);
  }

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
      role="dialog"
      aria-modal={isOpen}
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-background-card">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
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
                className="inline-flex size-10 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
                aria-label={t("common.close")}
              >
                <X className="size-6" aria-hidden="true" />
              </button>
            </div>

            <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border px-4 py-3 scrollbar-hide">
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
          </div>

          <div className="p-4">
        {filteredCards.length === 0 ? (
          <p className="py-8 text-center text-sm text-foreground-secondary">
            {t(status === "active" ? "inventory.emptyActiveDescription" : "quiz.noLearnedDescription")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredCards.map(({ card }) => (
              <div
                key={card.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  vibrate("tap");
                  setDisplayCard(card);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") {
                    return;
                  }
                  event.preventDefault();
                  vibrate("tap");
                  setDisplayCard(card);
                }}
                aria-label={card.term}
                className="relative rounded-xl border border-border bg-background-card p-3 text-left transition-colors hover:bg-background-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              >
                {status === "active" && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteCard(card.id);
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                    aria-label={`${card.term} ${t("common.delete")}`}
                    title={t("inventory.deleteConfirm")}
                    className="absolute right-1 top-1 inline-flex size-7 items-center justify-center rounded-full bg-background-muted text-foreground-secondary transition-colors hover:bg-rose-100 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                )}
                <p className="pr-6 text-sm font-bold text-foreground">{card.term}</p>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>

  <MobileCardDisplaySheet
    card={displayCard}
    isOpen={displayCard !== null}
    onClose={() => setDisplayCard(null)}
  />
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

function ActionButton({
  icon: Icon,
  label,
  locked,
  onClick,
  variant,
  dataTutorialTarget,
}: {
  icon: typeof GraduationCap;
  label: string;
  locked: boolean;
  onClick: () => void;
  variant: "active" | "learned";
  dataTutorialTarget?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={locked}
      data-tutorial-target={dataTutorialTarget}
      className={cn(
        "flex h-14 w-full items-center justify-center gap-2 rounded-xl border-0 text-base font-bold text-white shadow-lg transition-colors active:scale-[0.98]",
        variant === "active"
          ? "bg-emerald-500 hover:bg-emerald-600"
          : "bg-sky-500 hover:bg-sky-600",
        locked && "opacity-50",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {label}
    </button>
  );
}

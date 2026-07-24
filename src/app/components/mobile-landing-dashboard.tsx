"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { GraduationCap, Info, RotateCcw, Trash2, X } from "lucide-react";
import { LANGUAGES } from "@/data/languages";
import { TIERS, TIER_STYLES } from "@/data/tiers";
import { MissionIcon } from "@/components/mission-icon";
import { ScoreIcon } from "@/components/score-icon";
import { LanguageFlag } from "@/components/language-flag";
import { MobileLanguageBottomSheet } from "@/app/components/mobile-language-bottom-sheet";
import { MobileLandingInfoSheet } from "@/app/components/mobile-landing-info-sheet";
import { MobileRankInfoSheet } from "@/app/components/mobile-rank-info-sheet";
import { MobileLockedActionSheet } from "@/app/components/mobile-locked-action-sheet";
import { MobileCardDisplaySheet } from "@/app/components/mobile-card-display-sheet";
import { MobileLandingCardCenter } from "@/app/components/mobile-landing-card-center";
import { MobileCardSwipeOverlay } from "@/app/components/mobile-card-swipe-overlay";
import { MobileCustomCardSheet } from "@/app/components/mobile-custom-card-sheet";
import {
  readLandingCardLanguage,
  subscribeLandingCardLanguage,
  writeLandingCardLanguage,
} from "@/app/components/landing-card-language";
import { UpgradeDialog, type UpgradeDialogErrorCode } from "@/features/subscriptions/components/upgrade-dialog";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { useAuthSession, useRequireAuthAction } from "@/features/auth/auth-client";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import {
  consumePlayReviewEligibility,
  hasPlayReviewEligibility,
} from "@/features/reviews/play-review-eligibility";
import { useProgressStats } from "@/features/progress/progress-client";
import { RANK_ICON_ASSETS } from "@/features/progress/rank-icons";
import { formatNumber, getLanguageDisplayName, getRankLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { useDetectedLocale } from "@/i18n/use-detected-locale";
import { cn } from "@/lib/utils";
import {
  resolveCardLanguageOnSiteLocaleChange,
  resolveMobileLandingLanguage,
} from "@/app/components/mobile-landing-language-guard";
import { useMissionWaitingCount } from "@/features/missions/use-mission-waiting-count";
import { MissionsPanel } from "@/features/missions/components/missions-panel";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";

import { vibrate } from "@/lib/vibration";
import { beginNavigationIntent, isActiveNavigationIntent } from "@/lib/navigation-intent";
import { navigateWithRouteTransition } from "@/lib/route-transition";
import { requestGooglePlayReview } from "@/lib/twa-analytics";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

function parseLandingLanguage(value: string | null): LanguageCode | null {
  return value && LANGUAGES.some((item) => item.code === value) ? (value as LanguageCode) : null;
}

const MOBILE_TOP_ACTION_LABEL_CLASSNAME =
  "whitespace-nowrap text-left font-semibold leading-none text-[#3E82D1]";

export function MobileLandingDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuthSession();
  const { stats } = useProgressStats();
  const { locale, setLocale } = useLocale();
  const detectedLocale = useDetectedLocale();
  const t = useT();
  const requireAuthAction = useRequireAuthAction();
  const { refreshEntitlements } = useSubscription();
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const isTwa = useTwaMode();
  const waitingMissionCount = useMissionWaitingCount();
  const { data: leaderboardData } = useLeaderboardData({
    enabled: Boolean(user),
    refreshOnMount: true,
  });

  const defaultLanguage = useMemo<LanguageCode>(() => {
    const requestedLanguage = parseLandingLanguage(searchParams.get("language"));

    if (requestedLanguage) {
      return requestedLanguage;
    }

    const preferred = user?.profile.preferredLanguageCode;
    if (preferred && LANGUAGES.some((item) => item.code === preferred)) {
      return preferred;
    }
    if (LANGUAGES.some((item) => item.code === locale)) {
      return locale;
    }
    return "en";
  }, [searchParams, user?.profile.preferredLanguageCode, locale]);

  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(defaultLanguage);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [rankInfoOpen, setRankInfoOpen] = useState(false);
  const [lockedSheet, setLockedSheet] = useState<"active" | "learned" | null>(null);
  const [showLanguageMatchDialog, setShowLanguageMatchDialog] = useState(false);
  const [showLearnedReviewUpgrade, setShowLearnedReviewUpgrade] = useState(false);
  const [cardLimitError, setCardLimitError] = useState<UpgradeDialogErrorCode | null>(null);
  const [missionsPanelOpen, setMissionsPanelOpen] = useState(false);
  const [swipeDeckOpen, setSwipeDeckOpen] = useState(false);
  const [customCardOpen, setCustomCardOpen] = useState(false);
  const [cardCenterStatus, setCardCenterStatus] = useState<"all" | "active" | "learned">("all");
  const [cardCenterOpen, setCardCenterOpen] = useState(false);
  const allowRequestedLanguageRef = useRef(parseLandingLanguage(searchParams.get("language")) !== null);
  const hasPendingStoredLandingLanguageRef = useRef(false);

  useEffect(() => {
    router.prefetch("/create-card");
  }, [router]);

  useEffect(() => {
    if (!isTwa || !hydrated || cards.length < 10 || !hasPlayReviewEligibility()) {
      return;
    }

    if (!consumePlayReviewEligibility()) {
      return;
    }

    requestGooglePlayReview();
  }, [cards.length, hydrated, isTwa]);

  useEffect(() => {
    // Browser storage is intentionally read after hydration. Reading it while
    // initializing state can make the first client render differ from SSR.
    const stored = readLandingCardLanguage();
    if (!allowRequestedLanguageRef.current && stored) {
      hasPendingStoredLandingLanguageRef.current = true;
      setSelectedLanguage(stored);
    }

    return subscribeLandingCardLanguage(() => {
      const nextStoredLanguage = readLandingCardLanguage();

      if (!nextStoredLanguage) {
        return;
      }

      allowRequestedLanguageRef.current = false;
      setSelectedLanguage(nextStoredLanguage);
    });
  }, []);

  useEffect(() => {
    if (allowRequestedLanguageRef.current) {
      return;
    }

    // Let the post-hydration storage restore win over automatic locale syncing.
    if (hasPendingStoredLandingLanguageRef.current) {
      hasPendingStoredLandingLanguageRef.current = false;
      return;
    }

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

    writeLandingCardLanguage(nextLanguage, { notify: false });
    const timeoutId = window.setTimeout(() => {
      setSelectedLanguage(nextLanguage);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [locale, selectedLanguage, detectedLocale]);

  useEffect(() => {
    const requestedLanguage = parseLandingLanguage(searchParams.get("language"));
    let timeoutId: number | undefined;

    if (requestedLanguage) {
      allowRequestedLanguageRef.current = true;
      writeLandingCardLanguage(requestedLanguage, { notify: false });
      timeoutId = window.setTimeout(() => {
        setSelectedLanguage(requestedLanguage);
      }, 0);
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [searchParams, pathname, router]);

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
  const hasLandingLayerOpen =
    languageSheetOpen ||
    infoSheetOpen ||
    rankInfoOpen ||
    lockedSheet !== null ||
    showLanguageMatchDialog ||
    showLearnedReviewUpgrade ||
    cardLimitError !== null ||
    missionsPanelOpen ||
    swipeDeckOpen ||
    customCardOpen ||
    cardCenterOpen;
  const leaderboardViewer = leaderboardData?.viewer;
  const leaderboardPosition =
    leaderboardViewer && leaderboardViewer.userId === user?.id ? leaderboardViewer.position : null;
  const leaderboardButtonLabel = leaderboardPosition
    ? t("home.mobile.leaderboardBadge", {
        position: formatNumber(locale, leaderboardPosition),
      })
    : "";
  const leaderboardButtonLabelClassName =
    leaderboardButtonLabel.length > 14
      ? "text-[0.58rem]"
      : leaderboardButtonLabel.length > 11
        ? "text-[0.66rem]"
        : "text-[0.72rem]";

  function handleDrawCards() {
    vibrate("tap");
    requireAuthAction(() => {
      setSwipeDeckOpen(true);
    }, { nextPath: "/" });
  }

  function handleCreateCard() {
    vibrate("tap");
    requireAuthAction(() => {
      setCustomCardOpen(true);
    }, { nextPath: "/" });
  }

  function closeLockedSheetThen(action: () => void) {
    setLockedSheet(null);
    window.setTimeout(action, 220);
  }

  function handleLockedSheetDraw() {
    closeLockedSheetThen(handleDrawCards);
  }

  function handleLockedSheetCreate() {
    closeLockedSheetThen(handleCreateCard);
  }

  function handleLockedSheetStartLearning() {
    if (activeCount === 0) return;
    closeLockedSheetThen(handleStartLearning);
  }

  function handleStartLearning() {
    vibrate("tap");
    if (activeCount === 0) {
      setLockedSheet("active");
      return;
    }
    const nextPath = `/learn?mode=active&language=${encodeURIComponent(selectedLanguage)}`;
    const navigationIntent = beginNavigationIntent();
    requireAuthAction(() => {
      if (!isActiveNavigationIntent(navigationIntent)) return;
      navigateWithRouteTransition(() => router.push(nextPath));
    }, { nextPath });
  }

  function handleRepeatLearned() {
    vibrate("tap");
    if (learnedCount === 0) {
      setLockedSheet("learned");
      return;
    }
    const nextPath = `/learn?mode=learned&language=${encodeURIComponent(selectedLanguage)}`;
    const navigationIntent = beginNavigationIntent();
    requireAuthAction(() => {
      void verifyLearnedReviewAccess(nextPath, navigationIntent);
    }, { nextPath });
  }

  async function verifyLearnedReviewAccess(nextPath: string, navigationIntent: number) {
    const verifiedEntitlements = await refreshEntitlements();

    if (!isActiveNavigationIntent(navigationIntent)) {
      return;
    }

    if ((verifiedEntitlements?.effectivePlan ?? "free") === "free") {
      setShowLearnedReviewUpgrade(true);
      return;
    }

    navigateWithRouteTransition(() => router.push(nextPath));
  }

  function handleSelectLanguage(language: LanguageCode) {
    vibrate("tap");
    allowRequestedLanguageRef.current = false;

    if (language === locale) {
      setShowLanguageMatchDialog(true);
      return;
    }

    const resolved = resolveMobileLandingLanguage(language, locale, detectedLocale);
    const nextCardLanguage = resolved.cardLanguage;

    writeLandingCardLanguage(nextCardLanguage, { notify: false });

    if (resolved.siteLocale !== locale) {
      setLocale(resolved.siteLocale);
    }

    setSelectedLanguage(nextCardLanguage);
  }

  function openCardCenter(status: "active" | "learned") {
    vibrate("tap");
    setCardCenterStatus(status);
    setCardCenterOpen(true);

    window.requestAnimationFrame(() => {
      const scrollContainer = document.querySelector<HTMLElement>("[data-mobile-landing-dashboard]");
      const cardCenter = scrollContainer?.querySelector<HTMLElement>("[data-mobile-card-center]");

      if (scrollContainer && cardCenter) {
        scrollContainer.scrollTo({ top: cardCenter.offsetTop, behavior: "smooth" });
      }
    });
  }

  function handleCardCenterOpenChange(nextOpen: boolean) {
    vibrate("tap");
    setCardCenterOpen(nextOpen);

    window.requestAnimationFrame(() => {
      const scrollContainer = document.querySelector<HTMLElement>("[data-mobile-landing-dashboard]");
      const cardCenter = scrollContainer?.querySelector<HTMLElement>("[data-mobile-card-center]");

      scrollContainer?.scrollTo({
        top: nextOpen && cardCenter ? cardCenter.offsetTop : 0,
        behavior: "smooth",
      });
    });
  }

  return (
    <section data-mobile-landing-dashboard className={cn("relative h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] overscroll-contain bg-background px-4 py-1 lg:hidden", cardCenterOpen ? "overflow-y-auto" : "overflow-y-hidden")}>
      {/* Leaderboard badge */}
      <button
        type="button"
        onClick={() => {
          vibrate("tap");
          const navigationIntent = beginNavigationIntent();
          requireAuthAction(() => {
            if (!isActiveNavigationIntent(navigationIntent)) return;
            navigateWithRouteTransition(() => router.push("/leaderboard"));
          }, { nextPath: "/leaderboard" });
        }}
        className="absolute left-2 top-2 z-50 inline-flex h-[2.45rem] w-[2.45rem] touch-manipulation items-center justify-center text-white transition-transform active:scale-[0.98]"
        aria-label={t("leaderboard.open")}
        data-tutorial-target="leaderboard"
      >
        <Image
          src="/leaderboard-icon.png"
          alt=""
          aria-hidden="true"
          width={31}
          height={31}
          className="h-[2rem] w-auto object-contain"
        />
        {leaderboardButtonLabel ? (
          <span
            className={cn(
              "absolute -bottom-3 left-[0.2rem] origin-bottom-left -rotate-12 inline-flex whitespace-nowrap bg-gradient-to-r from-[#FDF4A5] to-[#F5AC27] bg-clip-text px-0.5 py-px !text-transparent",
              MOBILE_TOP_ACTION_LABEL_CLASSNAME,
              leaderboardButtonLabelClassName,
              canUseSuperWater(locale) && "font-super-water",
            )}
          >
            {formatSuperWaterText(locale, leaderboardButtonLabel)}
          </span>
        ) : null}
      </button>

      {/* Missions action */}
      <button
        type="button"
        onClick={() => {
          vibrate("tap");
          const navigationIntent = beginNavigationIntent();
          requireAuthAction(() => {
            if (typeof window !== "undefined" && window.innerWidth >= 1024) {
              if (!isActiveNavigationIntent(navigationIntent)) return;
              navigateWithRouteTransition(() => router.push("/missions"));
              return;
            }
            setMissionsPanelOpen(true);
          }, { nextPath: "/missions" });
        }}
        className="absolute right-2 top-2 z-40 inline-flex h-[2.45rem] touch-manipulation items-center gap-2 text-white transition-transform active:scale-[0.98]"
        aria-label={t("home.mobile.missions")}
      >
        <span className="relative inline-flex h-[2.45rem] w-[2.45rem] shrink-0 items-center justify-center" data-mobile-missions-icon>
          <MissionIcon size={31} className="h-[2rem] w-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.16)]" />
          {waitingMissionCount > 0 ? (
            <span
              className={cn(
                "absolute -left-2 -bottom-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-[0_6px_16px_rgba(239,68,68,0.32)] animate-mission-badge-pulse",
                canUseSuperWater(locale) && "font-super-water",
              )}
            >
              {formatSuperWaterText(locale, waitingMissionCount > 9 ? "9+" : String(waitingMissionCount))}
            </span>
          ) : null}
        </span>
      </button>

      {/* Info icon */}
      <button
        type="button"
        onClick={() => {
          vibrate("tap");
          setInfoSheetOpen(true);
        }}
        data-mobile-landing-info-action
        hidden
        className="absolute right-0 top-14 z-50 hidden size-12 touch-manipulation items-center justify-center rounded-full text-white transition-colors hover:text-white/80"
        aria-label={t("home.mobile.infoTitle")}
      >
        <Info className="size-5" aria-hidden="true" />
      </button>

      {/* Rank */}
      <div data-tutorial-target="rank-info" className="relative -mx-4 flex h-[250px] flex-none flex-col items-center gap-0.5 rounded-none px-4 pt-2 pb-1 text-white">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white to-white/50 dark:from-black dark:to-black/50"
          aria-hidden="true"
        />
        <span className="relative z-10 hidden text-[10px] font-bold uppercase tracking-widest text-white/60">
          {t("home.mobile.rankLabel")}
        </span>
        <div className="relative z-10 flex h-[150px] w-full items-center justify-center self-stretch">
          <button
            type="button"
            onClick={() => {
              vibrate("tap");
              setRankInfoOpen(true);
            }}
            className="inline-flex h-full w-[150px] items-center justify-center transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            aria-label={getRankLabel(stats.rank, locale)}
            data-rank-icon-button
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={RANK_ICON_ASSETS[stats.rank.icon]}
              alt=""
              className="h-[136px] w-auto object-contain"
              draggable={false}
            />
          </button>
        </div>
        <h1 className={cn("relative z-10 text-center text-lg font-bold text-white", canUseSuperWater(locale) && "font-super-water")}>
          {formatSuperWaterText(locale, getRankLabel(stats.rank, locale))}
        </h1>
        <div
          className="relative z-10 mt-0.5 flex items-center gap-1.5 text-[1.45rem] font-bold leading-none text-white"
          aria-label={`${formatNumber(locale, stats.totalPoints)} ${t("home.mobile.pointsLabel")}`}
        >
          <span className="bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-500 bg-clip-text text-transparent">
            {formatNumber(locale, stats.totalPoints)}
          </span>
          <ScoreIcon size={28} className="h-7 w-auto drop-shadow-[0_6px_16px_rgba(0,0,0,0.22)]" />
        </div>
      </div>

      {/* Language selector */}
      <button
        type="button"
        data-mobile-landing-card-language
        onClick={() => {
          vibrate("tap");
          setLanguageSheetOpen(true);
        }}
        className="flex h-14 w-full shrink-0 items-center justify-between rounded-xl border border-black/10 bg-white px-4 text-left text-black transition-colors hover:bg-slate-100"
      >
        <span className="flex items-center gap-3">
          <LanguageFlag code={selectedLanguage} className="h-6 w-9" />
          <span className="text-base font-semibold text-black">
            {getLanguageDisplayName(selectedLanguage, locale)}
          </span>
        </span>
        <span className="text-xs font-semibold text-slate-500">
          {t("home.mobile.cardLanguage")}
        </span>
      </button>

      {/* Active / Learned row */}
      <div className="relative mt-2 grid grid-cols-2 overflow-hidden rounded-lg border border-border">
        <StatusBlock
          title={t("home.mobile.activeCards")}
          count={activeCount}
          variant="active"
          onClick={() => openCardCenter("active")}
          dataTutorialTarget="landing-learning-cards"
        />
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-sm font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.25)]">
          {t("nav.inventory")}
        </span>
        <StatusBlock
          title={t("home.mobile.learnedCards")}
          count={learnedCount}
          variant="learned"
          onClick={() => openCardCenter("learned")}
        />
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex flex-col gap-3 pb-1">
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
          dataTutorialTarget="repeat-learned"
        />
      </div>

      <MobileLandingCardCenter
        activeCards={activeForLanguage}
        learnedCards={learnedForLanguage}
        selectedLanguage={selectedLanguage}
        status={cardCenterStatus}
        isOpen={cardCenterOpen}
        onStatusChange={setCardCenterStatus}
        onOpenChange={handleCardCenterOpenChange}
        onOpenDraw={handleDrawCards}
        onOpenCreate={handleCreateCard}
        showEmptyDeckPointer={activeCount === 0 && !hasLandingLayerOpen}
      />

      {/* Sheets */}
      <MobileLanguageBottomSheet
        isOpen={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        options={languageStats}
        selectedLanguage={selectedLanguage}
        onSelect={handleSelectLanguage}
      />

      <MobileLandingInfoSheet
        isOpen={infoSheetOpen}
        onClose={() => setInfoSheetOpen(false)}
      />

      <MobileRankInfoSheet
        isOpen={rankInfoOpen}
        onClose={() => setRankInfoOpen(false)}
        rank={stats.rank}
        totalPoints={stats.totalPoints}
      />

      <MobileLockedActionSheet
        isOpen={lockedSheet !== null}
        onClose={() => setLockedSheet(null)}
        variant={lockedSheet ?? "active"}
        onOpenDraw={handleLockedSheetDraw}
        onOpenCreate={handleLockedSheetCreate}
        onStartLearning={handleLockedSheetStartLearning}
        canStartLearning={activeCount > 0}
      />

      <MobileCardSwipeOverlay
        open={swipeDeckOpen}
        language={selectedLanguage}
        onClose={() => setSwipeDeckOpen(false)}
        onSubscriptionLimitReached={(errorCode) => setCardLimitError(errorCode)}
      />
      <MobileCustomCardSheet
        open={customCardOpen}
        onClose={() => setCustomCardOpen(false)}
        landingLanguage={selectedLanguage}
        onSubscriptionLimitReached={(errorCode) => setCardLimitError(errorCode)}
      />

      <UpgradeDialog
        open={cardLimitError !== null}
        errorCode={cardLimitError}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setCardLimitError(null);
          }
        }}
        selectedLanguage={selectedLanguage}
      />

      <UpgradeDialog
        open={showLanguageMatchDialog}
        errorCode="language_match_not_allowed"
        onOpenChange={(nextOpen) => setShowLanguageMatchDialog(nextOpen)}
        onSwapLanguages={() => {
          const currentLocale = locale;
          const currentCardLanguage = selectedLanguage;
          setLocale(currentCardLanguage);
          writeLandingCardLanguage(currentLocale, { notify: true });
          setSelectedLanguage(currentLocale);
        }}
      />

      <UpgradeDialog
        open={showLearnedReviewUpgrade}
        errorCode="learned_review_subscription_required"
        onOpenChange={setShowLearnedReviewUpgrade}
      />

      <MissionsPanel
        open={missionsPanelOpen}
        onClose={() => setMissionsPanelOpen(false)}
      />
    </section>
  );
}

function StatusBlock({
  title,
  count,
  variant,
  onClick,
  dataTutorialTarget,
}: {
  title: string;
  count: number;
  variant: "active" | "learned";
  onClick: () => void;
  dataTutorialTarget?: string;
}) {
  const isActive = variant === "active";

  return (
    <button
      type="button"
      onClick={onClick}
      data-tutorial-target={dataTutorialTarget}
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

export function TierDetailMenu({
  isOpen,
  onClose,
  selectedTier,
  onTierChange,
  activeCards,
  learnedCards,
  status,
  onStatusChange,
  selectedLanguage,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedTier: Tier | "all";
  onTierChange: (tier: Tier | "all") => void;
  activeCards: ReturnType<typeof filterInventoryCards>;
  learnedCards: ReturnType<typeof filterInventoryCards>;
  status: "active" | "learned";
  onStatusChange: (status: "active" | "learned") => void;
  selectedLanguage: LanguageCode;
}) {
  const { locale } = useLocale();
  const t = useT();
  const removeCard = useInventoryStore((state) => state.removeCard);
  const pendingCardIds = useInventoryStore((state) => state.pendingCardIds);
  const [displayCard, setDisplayCard] = useState<VocabularyCard | null>(null);

  function handleDeleteCard(cardId: string) {
    if (pendingCardIds.has(cardId)) {
      return;
    }

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
                data-tutorial-target="close-collection-menu"
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

            <div
              className={cn(
                "px-4 py-2 text-center text-xs font-semibold text-white",
                status === "active" ? "bg-emerald-500" : "bg-sky-500",
              )}
            >
              {t(
                status === "active" ? "home.mobile.activeCardsInfo" : "home.mobile.learnedCardsInfo",
                { language: getLanguageDisplayName(selectedLanguage, locale) },
              )}
            </div>
          </div>

          <div className="p-4">
        {filteredCards.length === 0 ? (
          <p className="py-8 text-center text-sm text-foreground-secondary">
            {t(status === "active" ? "inventory.emptyActiveDescription" : "quiz.noLearnedDescription")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredCards.map(({ card }) => {
              const tierStyle = TIER_STYLES[card.tier];
              return (
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
                  className="relative flex flex-col overflow-hidden rounded-xl border border-white/20 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  <div className="flex items-center justify-between gap-2 bg-white px-3 py-1.5">
                    <p className="break-words text-sm font-bold text-black">{card.term}</p>
                    {status === "active" && (
                      <button
                        type="button"
                        disabled={pendingCardIds.has(card.id)}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteCard(card.id);
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        aria-label={`${card.term} ${t("common.delete")}`}
                        title={t("inventory.deleteConfirm")}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-transparent text-black transition-colors hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className={cn("relative flex flex-1 flex-col justify-between px-3 py-2", tierStyle.accent)}>
                    <div className="absolute inset-0 bg-black/20" />
                    <p className="relative z-10 text-xs text-white/90 line-clamp-2">
                      {card.translations[locale] || card.translation}
                    </p>
                    <span className="relative z-10 mt-2 inline-flex text-[10px] font-bold text-white">
                      {card.tier}
                    </span>
                  </div>
                </div>
              );
            })}
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
    <div className={cn(
      "mobile-primary-action-depth w-full rounded-xl",
      variant === "active" ? "mobile-primary-action-depth--emerald" : "mobile-primary-action-depth--sky",
      locked && "mobile-primary-action-depth--locked",
    )}>
      <button
        type="button"
        onClick={onClick}
        aria-disabled={locked}
        data-tutorial-target={dataTutorialTarget}
        className={cn(
          "flex h-14 w-full items-center justify-center gap-2 rounded-xl border-0 text-base font-bold text-white transition-colors active:scale-[0.98]",
          variant === "active"
            ? locked ? "bg-emerald-500 hover:bg-emerald-500" : "bg-emerald-500 hover:bg-emerald-600"
            : locked ? "bg-sky-500 hover:bg-sky-500" : "bg-sky-500 hover:bg-sky-600",
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
        {label}
      </button>
    </div>
  );
}

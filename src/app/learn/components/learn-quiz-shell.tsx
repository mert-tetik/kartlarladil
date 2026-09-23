"use client";

import { GraduationCap, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { NoCardsEmptyState } from "@/features/inventory/components/no-cards-empty-state";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { QuizStation } from "@/features/quiz/components/quiz-station";
import type { QuizPhase } from "@/features/quiz/components/quiz-station";
import { LearnedCelebrationTest } from "@/app/learn/components/learned-celebration-test";
import { QuizStartTest } from "@/app/learn/components/quiz-start-test";
import { StreakCelebrationTest } from "@/app/learn/components/streak-celebration-test";
import { StreakRewardTest } from "@/app/learn/components/streak-reward-test";
import { QuizResultTest } from "@/app/learn/components/quiz-result-test";
import { QuizResultMessageTest } from "@/app/learn/components/quiz-result-message-test";
import { BonusQuestionsTest } from "@/app/learn/components/bonus-questions-test";
import { NormalQuestionsTest } from "@/app/learn/components/normal-questions-test";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/i18n/locale-provider";
import { useOptionalAuthSession } from "@/features/auth/auth-client";
import { navigateWithRouteTransition } from "@/lib/route-transition";
import type { LanguageCode, PracticeMode } from "@/types/domain";

type LearnShellPhase = QuizPhase | "mode";

interface LearnQuizShellProps {
  title: string;
  description: string;
  initialMode: PracticeMode | null;
  initialLanguage?: LanguageCode | null;
  learnedCelebrationTest?: boolean;
  startTest?: boolean;
  streakTest?: boolean;
  streakRewardTest?: boolean;
  resultTest?: boolean;
  resultMessageTest?: boolean;
  bonusTest?: boolean;
  normalTest?: boolean;
}

export function LearnQuizShell({
  title,
  initialMode,
  initialLanguage,
  learnedCelebrationTest = false,
  startTest = false,
  streakTest = false,
  streakRewardTest = false,
  resultTest = false,
  resultMessageTest = false,
  bonusTest = false,
  normalTest = false,
}: LearnQuizShellProps) {
  const [selectedMode, setSelectedMode] = useState<PracticeMode | null>(initialMode);
  const initialPhase: LearnShellPhase = initialMode
    ? (initialLanguage ? "count" : "language")
    : "mode";
  const [phase, setPhase] = useState<LearnShellPhase>(initialPhase);
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudLoading = useInventoryStore((state) => state.cloudLoading);
  const cloudEnabled = useInventoryStore((state) => state.cloudEnabled);
  const cloudLoadComplete = useInventoryStore((state) => state.cloudLoadComplete);
  const ownerUserId = useInventoryStore((state) => state.ownerUserId);
  const router = useRouter();
  const authSession = useOptionalAuthSession();
  const { locale } = useLocale();
  const t = useT();
  const redirectStartedRef = useRef(false);
  const showHeader = phase === "mode" || phase === "language" || phase === "count";
  const canRenderPersistedPool = cards.length > 0;
  // The store starts with `cloudLoadComplete: true` for guest/local use. An
  // authenticated render can therefore not use that default as proof that
  // the user's cloud inventory has loaded. Wait until cloud mode is enabled,
  // the request has completed, and the returned inventory is associated with
  // the current user before deciding that a quiz mode is empty.
  const cloudInventoryReady = !authSession?.user
    ? true
    : cloudEnabled && cloudLoadComplete && ownerUserId === authSession.user.id;

  const availablePracticeCards = useMemo(() => ({
    active: filterInventoryCards({ cards, status: "active" }).filter(({ card }) => card.language !== locale),
    learned: filterInventoryCards({ cards, status: "learned" }).filter(({ card }) => card.language !== locale),
  }), [cards, locale]);

  const hasUsableCardsForMode = useCallback(
    (mode: PracticeMode) => availablePracticeCards[mode].length > 0,
    [availablePracticeCards],
  );

  const redirectToLanding = useCallback(() => {
    if (redirectStartedRef.current) return;
    redirectStartedRef.current = true;
    navigateWithRouteTransition(() => router.replace("/"));
  }, [router]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setSelectedMode(initialMode);
      setPhase(initialMode ? "language" : "mode");
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialMode]);

  useEffect(() => {
    if (bonusTest || normalTest) return;

    if (!hydrated || cloudLoading || !cloudInventoryReady) {
      return;
    }

    const hasAnyUsablePracticeCards =
      hasUsableCardsForMode("active") || hasUsableCardsForMode("learned");
    const selectedModeIsUnavailable = selectedMode !== null && !hasUsableCardsForMode(selectedMode);

    if (!hasAnyUsablePracticeCards || selectedModeIsUnavailable) {
      redirectToLanding();
    }
  }, [
    bonusTest,
    cloudInventoryReady,
    cloudLoading,
    hasUsableCardsForMode,
    hydrated,
    normalTest,
    ownerUserId,
    redirectToLanding,
    selectedMode,
  ]);

  if (learnedCelebrationTest) {
    return <LearnedCelebrationTest />;
  }

  if (startTest) {
    return <QuizStartTest />;
  }

  if (streakTest) {
    return <StreakCelebrationTest />;
  }

  if (streakRewardTest) {
    return <StreakRewardTest />;
  }

  if (resultTest) {
    return <QuizResultTest />;
  }

  if (resultMessageTest) {
    return <QuizResultMessageTest />;
  }

  // Isolated test routes must remain available even when the visual-test
  // account has no persisted inventory. They provide their own fixture cards.
  if (normalTest) {
    return <NormalQuestionsTest />;
  }

  if (bonusTest) {
    return <BonusQuestionsTest />;
  }

  if ((!hydrated || cloudLoading || !cloudInventoryReady) && !canRenderPersistedPool) {
    return (
      <LearnQuizShellLoading
        title={title}
        showHeader={showHeader}
        loadingTitle={t("quiz.loadingTitle")}
        loadingDescription={t("quiz.loadingDescription")}
      />
    );
  }

  if (cards.length === 0) {
    return <NoCardsEmptyState variant="learn" className="max-lg:hidden" />;
  }

  return (
    <>
      <div
        data-learn-page-header
        className={cn(
          "max-lg:hidden",
          !showHeader && "lg:hidden",
        )}
      >
        <div className="relative left-1/2 w-screen -translate-x-1/2 bg-black px-4 py-4 text-white sm:px-6 lg:px-8">
          <PageHeader
            title={title}
            description=" "
            mascot="/mascots/mascot5.webp"
            mascotSize="lg"
            centered
            titleClassName="text-white text-5xl md:text-6xl lg:text-7xl"
            descriptionClassName="invisible"
          />
        </div>
      </div>
      <div
        data-learn-phase={phase}
        className="mt-8 flex min-h-0 flex-1 flex-col items-stretch max-lg:mt-0 max-lg:w-full"
      >
        {selectedMode ? (
          <QuizStation
            key={selectedMode}
            mode={selectedMode}
            initialLanguage={initialLanguage ?? undefined}
            onPhaseChange={setPhase}
            onBackToMode={() => {
              setSelectedMode(null);
              setPhase("mode");
            }}
          />
        ) : (
          <LearnModeSelection
            onSelect={(mode) => {
              if (!hasUsableCardsForMode(mode)) {
                redirectToLanding();
                return;
              }
              setSelectedMode(mode);
              setPhase("language");
            }}
          />
        )}
      </div>
    </>
  );
}

function LearnQuizShellLoading({
  title,
  showHeader,
  loadingTitle,
  loadingDescription,
}: {
  title: string;
  showHeader: boolean;
  loadingTitle: string;
  loadingDescription: string;
}) {
  return (
    <>
      <div
        data-learn-page-header
        className={cn(
          "max-lg:hidden",
          !showHeader && "lg:hidden",
        )}
      >
        <div className="relative left-1/2 w-screen -translate-x-1/2 bg-black px-4 py-4 text-white sm:px-6 lg:px-8">
          <PageHeader
            title={title}
            description=" "
            mascot="/mascots/mascot5.webp"
            mascotSize="lg"
            centered
            titleClassName="text-white text-5xl md:text-6xl lg:text-7xl"
            descriptionClassName="invisible"
          />
        </div>
      </div>

      <div className="mt-8 flex min-h-0 flex-1 flex-col items-stretch max-lg:mt-0 max-lg:w-full">
        <div
          role="status"
          aria-label={loadingTitle}
          className="animate-screen-pop mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background-card p-5 sm:p-8 lg:p-10 max-lg:max-w-none max-lg:rounded-none max-lg:border-x-0 max-lg:border-y-0 max-lg:p-4"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{loadingTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-foreground-secondary sm:text-base">{loadingDescription}</p>
          </div>

          <div className="mt-8 grid w-full gap-3 sm:gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <div
                key={index}
                className={cn(
                  "min-h-[136px] animate-pulse rounded-2xl border p-5 sm:min-h-[148px] sm:p-6",
                  index === 0 ? "border-[color:var(--action-learn)]/30 bg-[var(--action-learn)]/15" : "border-[color:var(--action-learned)]/30 bg-[var(--action-learned)]/15",
                )}
              />
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="aspect-[4/3] animate-pulse rounded-2xl border border-border bg-background" />
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="h-14 animate-pulse rounded-xl border border-border bg-background"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const MODE_STYLE = {
  active: {
    bg: "bg-action-learn",
    border: "border-[var(--action-learn)]",
    hover: "hover:bg-action-learn-hover",
  },
  learned: {
    bg: "bg-action-learned",
    border: "border-[var(--action-learned)]",
    hover: "hover:bg-action-review-hover",
  },
} as const;

export function LearnModeSelection({ onSelect }: { onSelect: (mode: PracticeMode) => void }) {
  const t = useT();

  return (
    <div className="animate-screen-pop mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-background-card p-5 sm:p-8 lg:p-10 max-lg:max-w-none max-lg:rounded-none max-lg:border-x-0 max-lg:border-y-0 max-lg:p-4">
      <div className="flex w-full max-w-3xl flex-col items-center justify-center">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
          {t("quiz.chooseModeTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-foreground-secondary sm:text-base">
            {t("quiz.chooseModeDescription")}
          </p>
        </div>

        <div className="mt-8 grid w-full gap-3 sm:gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelect("active")}
            className={cn(
              "flex min-h-[136px] flex-col justify-center rounded-2xl border p-5 text-left text-white transition-colors sm:min-h-[148px] sm:p-6",
              MODE_STYLE.active.bg,
              MODE_STYLE.active.border,
              MODE_STYLE.active.hover,
            )}
          >
            <div className="flex items-center gap-3">
              <GraduationCap className="size-6 shrink-0 text-white" aria-hidden="true" />
              <h3 className="text-xl font-semibold text-white">{t("inventory.learn")}</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/90">
              {t("page.learn.description")}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelect("learned")}
            className={cn(
              "flex min-h-[136px] flex-col justify-center rounded-2xl border p-5 text-left text-white transition-colors sm:min-h-[148px] sm:p-6",
              MODE_STYLE.learned.bg,
              MODE_STYLE.learned.border,
              MODE_STYLE.learned.hover,
            )}
          >
            <div className="flex items-center gap-3">
              <RotateCcw className="size-6 shrink-0 text-white" aria-hidden="true" />
              <h3 className="text-xl font-semibold text-white">{t("inventory.repeatPractice")}</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/90">
              {t("page.learned.practiceDescription")}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

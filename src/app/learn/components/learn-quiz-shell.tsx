"use client";

import { GraduationCap, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { RouteLoadingState } from "@/components/route-loading-state";
import { NoCardsEmptyState } from "@/features/inventory/components/no-cards-empty-state";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useQuizInventoryCards } from "@/features/quiz/use-quiz-inventory-cards";
import type { NormalQuizItem, QuizPhase } from "@/features/quiz/components/quiz-station";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/i18n/locale-provider";
import { useOptionalAuthSession } from "@/features/auth/auth-client";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { navigateWithRouteTransition } from "@/lib/route-transition";
import type { LanguageCode, PracticeMode } from "@/types/domain";

const QuizStation = dynamic(
  () => import("@/features/quiz/components/quiz-station").then((module) => module.QuizStation),
  { ssr: false, loading: () => <LearnQuizLoadingState /> },
);
const LearnedCelebrationTest = dynamic(
  () => import("@/app/learn/components/learned-celebration-test").then((module) => module.LearnedCelebrationTest),
  { ssr: false },
);
const CardProgressRevealTest = dynamic(
  () => import("@/app/learn/components/card-progress-reveal-test").then((module) => module.CardProgressRevealTest),
  { ssr: false },
);
const QuizStartTest = dynamic(
  () => import("@/app/learn/components/quiz-start-test").then((module) => module.QuizStartTest),
  { ssr: false },
);
const StreakCelebrationTest = dynamic(
  () => import("@/app/learn/components/streak-celebration-test").then((module) => module.StreakCelebrationTest),
  { ssr: false },
);
const StreakRewardTest = dynamic(
  () => import("@/app/learn/components/streak-reward-test").then((module) => module.StreakRewardTest),
  { ssr: false },
);
const QuizResultTest = dynamic(
  () => import("@/app/learn/components/quiz-result-test").then((module) => module.QuizResultTest),
  { ssr: false },
);
const QuizResultMessageTest = dynamic(
  () => import("@/app/learn/components/quiz-result-message-test").then((module) => module.QuizResultMessageTest),
  { ssr: false },
);
const QuizChestRewardTest = dynamic(
  () => import("@/app/learn/components/quiz-chest-reward-test").then((module) => module.QuizChestRewardTest),
  { ssr: false },
);
const QuizContinuationMotivationTest = dynamic(
  () => import("@/app/learn/components/quiz-continuation-motivation-test").then((module) => module.QuizContinuationMotivationTest),
  { ssr: false },
);
const BonusQuestionsTest = dynamic(
  () => import("@/app/learn/components/bonus-questions-test").then((module) => module.BonusQuestionsTest),
  { ssr: false },
);
const BonusRewardTest = dynamic(
  () => import("@/app/learn/components/bonus-reward-test").then((module) => module.BonusRewardTest),
  { ssr: false },
);
const NormalQuestionsTest = dynamic(
  () => import("@/app/learn/components/normal-questions-test").then((module) => module.NormalQuestionsTest),
  { ssr: false },
);
const QuizWordButtonTest = dynamic(
  () => import("@/app/learn/components/quiz-word-button-test").then((module) => module.QuizWordButtonTest),
  { ssr: false },
);
const QuizLeaderboardProgressTest = dynamic(
  () => import("@/app/learn/components/quiz-leaderboard-progress-test").then((module) => module.QuizLeaderboardProgressTest),
  { ssr: false },
);

function LearnQuizLoadingState() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-background" aria-busy="true">
      <RouteLoadingState idPrefix="learn-quiz-loading" />
    </div>
  );
}

type LearnShellPhase = QuizPhase | "mode";

interface LearnQuizShellProps {
  title: string;
  description: string;
  initialMode: PracticeMode | null;
  initialLanguage?: LanguageCode | null;
  learnedCelebrationTest?: boolean;
  cardProgressTest?: boolean;
  startTest?: boolean;
  streakTest?: boolean;
  streakRewardTest?: boolean;
  resultTest?: boolean;
  resultMessageTest?: boolean;
  chestRewardTest?: boolean;
  continuationMotivationTest?: boolean;
  bonusTest?: boolean;
  bonusMatchingTest?: boolean;
  bonusRewardTest?: boolean;
  bonusAfterEach?: boolean;
  normalTest?: boolean;
  normalQuestionType?: NormalQuizItem["questionType"] | null;
  quizWordButtonTest?: boolean;
  quizCompletionTest?: boolean;
  quizFlowTest?: boolean;
  quizLeaderboardTest?: boolean;
  quizWordRepetitionTest?: boolean;
}

export function LearnQuizShell({
  title,
  initialMode,
  initialLanguage,
  learnedCelebrationTest = false,
  cardProgressTest = false,
  startTest = false,
  streakTest = false,
  streakRewardTest = false,
  resultTest = false,
  resultMessageTest = false,
  chestRewardTest = false,
  continuationMotivationTest = false,
  bonusTest = false,
  bonusMatchingTest = false,
  bonusRewardTest = false,
  bonusAfterEach = false,
  normalTest = false,
  normalQuestionType = null,
  quizWordButtonTest = false,
  quizCompletionTest = false,
  quizFlowTest = false,
  quizLeaderboardTest = false,
  quizWordRepetitionTest = false,
}: LearnQuizShellProps) {
  const [selectedMode, setSelectedMode] = useState<PracticeMode | null>(initialMode);
  const presentationTestBypass = Boolean(
    normalQuestionType || quizCompletionTest || quizFlowTest || quizWordRepetitionTest,
  );
  const initialPhase: LearnShellPhase = initialMode
    ? initialLanguage
      ? presentationTestBypass
        ? "count"
        : "quiz-type"
      : "language"
    : "mode";
  const [phase, setPhase] = useState<LearnShellPhase>(initialPhase);
  const { cards } = useQuizInventoryCards(phase === "result");
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudLoading = useInventoryStore((state) => state.cloudLoading);
  const cloudEnabled = useInventoryStore((state) => state.cloudEnabled);
  const cloudLoadComplete = useInventoryStore((state) => state.cloudLoadComplete);
  const ownerUserId = useInventoryStore((state) => state.ownerUserId);
  const router = useRouter();
  const authSession = useOptionalAuthSession();
  const { entitlements, isLoading: subscriptionLoading } = useSubscription();
  const { locale } = useLocale();
  const redirectStartedRef = useRef(false);
  const showHeader = phase === "mode" || phase === "language" || phase === "quiz-type" || phase === "count";
  const canRenderPersistedPool = cards.length > 0;
  // The store starts with `cloudLoadComplete: true` for guest/local use. An
  // authenticated render can therefore not use that default as proof that
  // the user's cloud inventory has loaded. Wait until cloud mode is enabled,
  // the request has completed, and the returned inventory is associated with
  // the current user before deciding that a quiz mode is empty.
  const cloudInventoryReady = !authSession?.user
    ? true
    : cloudEnabled && cloudLoadComplete && ownerUserId === authSession.user.id;
  const hasLearnedReviewAccess = entitlements?.effectivePlan === "basic"
    || entitlements?.effectivePlan === "pro";
  const learnedReviewEntitlementsPending = selectedMode === "learned"
    && Boolean(authSession?.user)
    && subscriptionLoading
    && !entitlements;
  const learnedReviewLocked = selectedMode === "learned"
    && !learnedReviewEntitlementsPending
    && !hasLearnedReviewAccess;

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
      setPhase(initialPhase);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialMode, initialPhase]);

  useLayoutEffect(() => {
    const learnPage = document.querySelector<HTMLElement>("[data-learn-page]");
    if (!learnPage) return;

    if (phase === "count") {
      learnPage.setAttribute("data-count-background-active", "true");
    } else {
      learnPage.removeAttribute("data-count-background-active");
    }

    return () => {
      learnPage.removeAttribute("data-count-background-active");
    };
  }, [phase]);

  useEffect(() => {
    if (
      quizFlowTest ||
      bonusTest ||
      bonusRewardTest ||
      normalTest ||
      chestRewardTest ||
      continuationMotivationTest ||
      quizLeaderboardTest
    ) return;

    // The quiz itself may consume the final active cards by marking them
    // learned. Only redirect for an empty/unavailable setup; once the session
    // has started, QuizStation must finish its result flow instead.
    if (phase !== "mode" && phase !== "language" && phase !== "count") return;

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
    quizFlowTest,
    bonusTest,
    bonusRewardTest,
    cloudInventoryReady,
    cloudLoading,
    hasUsableCardsForMode,
    hydrated,
    normalTest,
    chestRewardTest,
    continuationMotivationTest,
    quizLeaderboardTest,
    phase,
    ownerUserId,
    redirectToLanding,
    selectedMode,
  ]);

  if (learnedCelebrationTest) {
    return <LearnedCelebrationTest />;
  }

  if (cardProgressTest) {
    return <CardProgressRevealTest />;
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

  if (chestRewardTest) {
    return <QuizChestRewardTest />;
  }

  if (continuationMotivationTest) {
    return <QuizContinuationMotivationTest />;
  }

  if (quizWordButtonTest) {
    return <QuizWordButtonTest />;
  }

  if (quizLeaderboardTest) {
    return <QuizLeaderboardProgressTest />;
  }

  // Isolated test routes must remain available even when the visual-test
  // account has no persisted inventory. They provide their own fixture cards.
  if (normalTest) {
    return <NormalQuestionsTest />;
  }

  if (bonusTest) {
    return <BonusQuestionsTest />;
  }

  if (bonusMatchingTest) {
    return <BonusQuestionsTest onlyMatching />;
  }

  if (bonusRewardTest) {
    return <BonusRewardTest />;
  }

  // Do not expose learned-card practice while an authenticated user's first
  // server entitlement lookup is unresolved. The server action remains the
  // authoritative gate if an entitlement expires during an active quiz.
  if (learnedReviewEntitlementsPending) {
    return null;
  }

  if ((!hydrated || cloudLoading || !cloudInventoryReady) && !canRenderPersistedPool) {
    return null;
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
        {selectedMode && !learnedReviewLocked ? (
          <div
            className="quiz-transition-stage relative flex min-h-0 flex-1 flex-col max-lg:fixed max-lg:inset-0 max-lg:z-0 max-lg:h-dvh max-lg:w-full"
          >
            <QuizStation
              key={selectedMode}
              mode={selectedMode}
              initialLanguage={initialLanguage ?? undefined}
              initialPresentationMode={presentationTestBypass ? "classic" : undefined}
              normalQuestionType={normalQuestionType}
              bonusAfterEachNormalQuestion={bonusAfterEach}
              quizCompletionTest={quizCompletionTest}
              quizFlowTest={quizFlowTest}
              quizWordRepetitionTest={quizWordRepetitionTest}
              onPhaseChange={setPhase}
              onBackToMode={() => {
                setSelectedMode(null);
                setPhase("mode");
              }}
              onBackToLanding={redirectToLanding}
            />
          </div>
        ) : (
          <LearnModeSelection
            onSelect={(mode) => {
              if (!hasUsableCardsForMode(mode)) {
                redirectToLanding();
                return;
              }
              if (mode === "learned" && !hasLearnedReviewAccess) {
                setSelectedMode("learned");
                setPhase("mode");
                return;
              }
              setSelectedMode(mode);
              setPhase(
                initialLanguage
                  ? presentationTestBypass
                    ? "count"
                    : "quiz-type"
                  : "language",
              );
            }}
          />
        )}
      </div>
      {learnedReviewLocked ? (
        <UpgradeDialog
          open
          errorCode="learned_review_subscription_required"
          onOpenChange={(open) => {
            if (!open && !hasLearnedReviewAccess) {
              setSelectedMode(null);
              setPhase("mode");
            }
          }}
        />
      ) : null}
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

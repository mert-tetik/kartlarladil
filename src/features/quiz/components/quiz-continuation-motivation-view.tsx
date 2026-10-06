"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  ImageActionButton,
  RESULT_BUTTON_IMAGES,
} from "@/components/image-action-button";
import { useLeaderboardOverlay } from "@/features/leaderboard/components/leaderboard-overlay-provider";
import type { LeaderboardPayload } from "@/features/leaderboard/leaderboard-types";
import {
  selectQuizContinuationMotivations,
  type QuizContinuationMotivation,
  type QuizContinuationMotivationInput,
} from "@/features/quiz/quiz-continuation-motivations";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatNumber } from "@/i18n/labels";
import { navigateWithRouteTransition } from "@/lib/route-transition";
import { cn } from "@/lib/utils";
import { RANK_ICON_ASSETS } from "@/features/progress/rank-icons";
import type { RankIconId } from "@/types/domain";

const MOTIVATION_IMAGES: Record<QuizContinuationMotivation["id"], string> = {
  nearLearned: "/quiz/continuation-motivations/almost-learned-card-ref-20261004.png?v=20261005-1",
  nearLevelUp: "/quiz/continuation-motivations/level-up-card-ref-20261004.png?v=20261005-1",
  nextRank: "/quiz/continuation-motivations/next-rank-classic-v2-20261004.png?v=20261005-1",
  missedChest: "/quiz/continuation-motivations/missed-chest-classic-v2-20261004.png?v=20261005-1",
  accuracy: "/quiz/continuation-motivations/accuracy-classic-v2-20261004.png?v=20261005-1",
  mistakes: "/quiz/continuation-motivations/mistakes-card-ref-20261004.png?v=20261005-1",
  remainingCards: "/quiz/continuation-motivations/waiting-cards-card-ref-20261004.png?v=20261005-1",
  xp: "/quiz/continuation-motivations/xp-classic-v2-20261004.png?v=20261005-1",
  gems: "/quiz/continuation-motivations/gems-classic-v2-20261004.png?v=20261005-1",
  leaderboard: "/leaderboard-icon-v20261006-2.png",
  medals: "/quiz/result-cards/star.png?v=20261005-1",
  drawCards: "/quiz/continuation-motivations/draw-cards-card-ref-20261004.png?v=20261005-1",
};

const CONTINUATION_TITLE_KEYS = [
  "quiz.continuation.randomTitle.one",
  "quiz.continuation.randomTitle.two",
  "quiz.continuation.randomTitle.three",
  "quiz.continuation.randomTitle.four",
  "quiz.continuation.randomTitle.five",
  "quiz.continuation.randomTitle.six",
  "quiz.continuation.randomTitle.seven",
] as const;

export function QuizContinuationMotivationView({
  input,
  hasMoreCardsToLearn,
  isReviewQuiz = false,
  prioritizeNextRank = false,
  leaderboardData = null,
  currentRankIcon = "trophy",
  nextRankIcon = "medal",
  onContinue,
  onExit,
  onDrawCards,
  onMotivationsResolved,
}: {
  input: QuizContinuationMotivationInput;
  hasMoreCardsToLearn: boolean;
  isReviewQuiz?: boolean;
  prioritizeNextRank?: boolean;
  leaderboardData?: LeaderboardPayload | null;
  currentRankIcon?: RankIconId;
  nextRankIcon?: RankIconId | null;
  onContinue: () => void;
  onExit: () => void;
  onDrawCards?: () => void;
  onMotivationsResolved?: (motivations: QuizContinuationMotivation[]) => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const { openLeaderboard } = useLeaderboardOverlay();
  const [titleKey] = useState(() => {
    const index = Math.floor(Math.random() * CONTINUATION_TITLE_KEYS.length);
    return CONTINUATION_TITLE_KEYS[index] ?? CONTINUATION_TITLE_KEYS[0];
  });
  const motivations = useMemo(
    () => selectQuizContinuationMotivations(input, { isReviewQuiz, prioritizeNextRank }),
    [input, isReviewQuiz, prioritizeNextRank],
  );
  useEffect(() => {
    onMotivationsResolved?.(motivations);
  }, [motivations, onMotivationsResolved]);
  const title = isReviewQuiz
    ? t("quiz.continuation.reviewTitle")
    : t(hasMoreCardsToLearn ? titleKey : "quiz.continuation.noCardsTitle");

  const goToCardDrawOverlay = () => {
    navigateWithRouteTransition(() => router.push("/?mission-action=draw-cards"));
  };

  return (
    <section
      className="absolute inset-0 z-[55] flex h-full w-full flex-col justify-center overflow-hidden bg-[var(--background)] px-4 py-5 text-center sm:px-6 sm:py-7"
      data-quiz-continuation-motivation
      data-has-more-cards={hasMoreCardsToLearn || isReviewQuiz ? "true" : "false"}
      data-review-quiz={isReviewQuiz ? "true" : "false"}
    >
      <div
        className="quiz-continuation-stagger-enter mx-auto flex w-full max-w-3xl flex-col items-center"
        style={{ "--quiz-continuation-delay": "0ms" } as CSSProperties}
      >
        <div className="relative mx-auto flex w-full max-w-xl items-center gap-2 px-1 sm:gap-3">
          <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
            <Image
              src={
                isReviewQuiz
                  ? "/quiz/continuation-motivations/review-motivation-character.png?v=20261005-1"
                  : hasMoreCardsToLearn
                  ? "/quiz/continuation-motivations/continue-motivation-character.png?v=20261005-1"
                  : "/mascots/mascot3.webp"
              }
              alt=""
              fill
              sizes="(max-width: 639px) 112px, 128px"
              quality={90}
              className="object-contain object-bottom"
              aria-hidden="true"
            />
          </div>
          <div className="relative min-w-0 flex-1 rounded-2xl border-[3px] border-[#AAAAAA] bg-background px-4 py-3 text-left shadow-sm before:absolute before:left-[-0.55rem] before:top-1/2 before:size-4 before:-translate-y-1/2 before:rotate-45 before:border-b-[3px] before:border-l-[3px] before:border-[#AAAAAA] before:bg-background sm:px-5 sm:py-4">
            <h2
              className="relative break-words text-xl font-bold leading-tight text-white sm:text-2xl"
            >
              {title}
            </h2>
          </div>
        </div>
      </div>

      <div
        className="quiz-continuation-stagger-enter mx-auto mt-6 w-full max-w-3xl overflow-hidden rounded-xl border border-foreground/20 bg-background-card/60 shadow-sm sm:mt-8"
        style={{ "--quiz-continuation-delay": "120ms" } as CSSProperties}
        data-quiz-continuation-motivation-list
      >
        {motivations.map((motivation, index) => {
          const motivationImage = MOTIVATION_IMAGES[motivation.id];
          const motivationMessageKey =
            motivation.id === "leaderboard"
              ? !leaderboardData
                ? "quiz.continuation.motivation.leaderboardPlaceholder"
                : leaderboardData.viewer.pointsPosition === 1
                  ? "quiz.continuation.motivation.leaderboardFirst"
                  : motivation.messageKey
              : motivation.messageKey;
          const motivationValues = motivation.id === "leaderboard" && leaderboardData
            ? {
                ...motivation.values,
                points: leaderboardData.viewer.totalPoints,
                position: leaderboardData.viewer.pointsPosition,
              }
            : motivation.values;
          return (
            <article
              key={motivation.id}
              className={cn(
                "quiz-continuation-stagger-enter flex min-h-28 min-w-0 flex-row items-center justify-start gap-[10px] border-b border-foreground/20 px-3 py-6 text-left last:border-b-0 sm:min-h-32 sm:px-4 sm:py-8",
              )}
              style={{
                "--quiz-continuation-delay": `${180 + index * 120}ms`,
              } as CSSProperties}
              data-quiz-continuation-motivation-card={motivation.id}
              data-strength={motivation.strength.toFixed(3)}
            >
              <span
                className="flex size-14 shrink-0 items-center justify-center sm:size-16"
              >
                {motivation.id === "nextRank" && nextRankIcon ? (
                  <span
                    className="relative block size-full"
                    data-next-rank-motivation-graphic
                    aria-hidden="true"
                  >
                    <Image
                      src={RANK_ICON_ASSETS[currentRankIcon]}
                      alt=""
                      width={1254}
                      height={1254}
                      sizes="32px"
                      unoptimized
                      className="absolute bottom-0 left-0 size-[52%] object-contain"
                    />
                    <Image
                      src={RANK_ICON_ASSETS[nextRankIcon]}
                      alt=""
                      width={1254}
                      height={1254}
                      sizes="48px"
                      unoptimized
                      className="absolute right-0 top-0 size-[76%] object-contain"
                    />
                  </span>
                ) : (
                  <Image
                    src={motivationImage}
                    alt=""
                    width={64}
                    height={64}
                    sizes="64px"
                    className={cn(
                      "size-full object-contain",
                      motivation.id === "leaderboard" && "scale-75",
                    )}
                    aria-hidden="true"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1 translate-x-1">
                <p className="text-base font-bold leading-snug text-foreground sm:text-lg">
                  {t(
                    motivationMessageKey,
                    Object.fromEntries(
                      Object.entries(motivationValues).map(([key, value]) => [
                        key,
                        typeof value === "number" ? formatNumber(locale, value) : value,
                      ]),
                    ),
                  )}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div
        className="quiz-continuation-stagger-enter mt-8 flex w-full items-center justify-center gap-4 pb-1 sm:gap-7 sm:pb-2"
        style={{ "--quiz-continuation-delay": "620ms" } as CSSProperties}
        data-quiz-continuation-actions
      >
        {hasMoreCardsToLearn || isReviewQuiz ? (
          <>
            <ImageActionButton
              imageSrc={RESULT_BUTTON_IMAGES.leaderboard}
              imageSizes="56px"
              className="size-14 sm:size-16"
              onClick={() => openLeaderboard()}
              aria-label={t("leaderboard.title")}
              data-continuation-action="leaderboard"
            />
            <ImageActionButton
              imageSrc={
                isReviewQuiz
                  ? "/result-buttons/replay_button_blue.png"
                  : RESULT_BUTTON_IMAGES.play
              }
              imageSizes="80px"
              className="size-20 sm:size-24"
              onClick={onContinue}
              aria-label={t("quiz.continue")}
              data-continuation-action={isReviewQuiz ? "review-replay" : "continue"}
            />
            <ImageActionButton
              imageSrc={RESULT_BUTTON_IMAGES.menu}
              imageSizes="56px"
              className="size-14 sm:size-16"
              onClick={onExit}
              aria-label={t("quiz.exit")}
              data-continuation-action="menu"
            />
          </>
        ) : (
          <button
            type="button"
            onClick={onDrawCards ?? goToCardDrawOverlay}
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand px-7 py-3 text-base font-bold text-white shadow-[0_5px_0_color-mix(in_srgb,var(--brand)_65%,black)] transition-transform hover:scale-[1.02] active:translate-y-1 active:shadow-none sm:min-h-16 sm:px-10 sm:text-lg"
            data-continuation-action="draw-cards"
          >
            {t("quiz.continuation.drawCardsButton")}
            <ArrowRight className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}

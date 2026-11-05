"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MainPointsDisplay } from "@/features/progress/components/main-points-display";
import { RewardGemHud } from "@/features/progress/components/reward-gem-hud";
import { RewardScatter } from "@/features/progress/components/reward-scatter";
import { useAuthSession } from "@/features/auth/auth-client";
import { awardQuizPerformancePoints } from "@/features/quiz/actions";
import {
  getQuizPerformanceRewardBreakdown,
  getQuizPerformanceRankUp,
  type QuizPerformanceRankUp,
  type QuizPerformanceRewardInput,
} from "@/features/quiz/quiz-performance-rewards";
import { useLocale } from "@/i18n/locale-provider";
import { formatNumber } from "@/i18n/labels";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";

type RewardCategory = "accuracy" | "time" | "correct" | "learned";

interface RewardRequest {
  id: RewardCategory;
  amount: number;
  startDelayMs: number;
}

export function QuizPerformanceRewardSequence({
  sessionId,
  input,
  currentTotalPoints,
  entered,
  exiting,
  onPointsArrive,
  onRewardsFinished,
  onRankCheckComplete,
  onAwardError,
  onAwardPersisted,
}: {
  sessionId: string | null;
  input: QuizPerformanceRewardInput;
  currentTotalPoints: number;
  entered: boolean;
  exiting: boolean;
  onPointsArrive: (amount: number) => void;
  onRewardsFinished?: () => void;
  onRankCheckComplete?: (rankUp: QuizPerformanceRankUp | null) => void;
  onAwardError?: () => void;
  onAwardPersisted?: (pointsBeforeAward: number) => Promise<QuizPerformanceRankUp | null>;
}) {
  const { locale } = useLocale();
  const { user, updateProfileField, refreshProfile } = useAuthSession();
  const rewardBreakdown = useMemo(() => getQuizPerformanceRewardBreakdown(input), [input]);
  const categories = useMemo(() => {
    if (!rewardBreakdown) return [];

    return ([
      ["accuracy", rewardBreakdown.accuracyPoints],
      ["time", rewardBreakdown.timePoints],
      ["correct", rewardBreakdown.correctPoints],
      ["learned", rewardBreakdown.learnedPoints],
    ] as const)
      .filter(([, amount]) => amount > 0)
      .map(([id, amount], index) => ({ id, amount, startDelayMs: index * 400 }));
  }, [rewardBreakdown]);
  const [requests, setRequests] = useState<RewardRequest[]>([]);
  const [arrivedPoints, setArrivedPoints] = useState(0);
  const [scorePulse, setScorePulse] = useState(0);
  const [hudVisible, setHudVisible] = useState(false);
  const [hudExiting, setHudExiting] = useState(false);
  const targetRef = useRef<HTMLSpanElement>(null);
  const scheduleStartedRef = useRef(false);
  const persistStartedSessionRef = useRef<string | null>(null);
  const startedCategoriesRef = useRef(new Set<RewardCategory>());
  const arrivedPointsByCategoryRef = useRef<Record<RewardCategory, number>>({
    accuracy: 0,
    time: 0,
    correct: 0,
    learned: 0,
  });
  const completedCategoriesRef = useRef(new Set<RewardCategory>());
  const sequenceTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  const exitingRef = useRef(exiting);
  const completionNotifiedRef = useRef(false);

  const safeCurrentTotalPoints = Number.isFinite(currentTotalPoints)
    ? Math.max(0, Math.floor(currentTotalPoints))
    : 0;
  const [baseTotalPoints] = useState(safeCurrentTotalPoints);

  useEffect(() => {
    exitingRef.current = exiting;
  }, [exiting]);

  useEffect(() => {
    if (!user || !sessionId || !rewardBreakdown || rewardBreakdown.totalPoints <= 0) return;
    if (persistStartedSessionRef.current === sessionId) return;
    persistStartedSessionRef.current = sessionId;

    const reconcileRank = async () => {
      try {
        return onAwardPersisted
          ? await onAwardPersisted(safeCurrentTotalPoints)
          : (await refreshProfile(), null);
      } catch {
        return null;
      }
    };

    void awardQuizPerformancePoints(sessionId, input).then((result) => {
      if (!result.success) {
        onAwardError?.();
        void reconcileRank().then((rankUp) => onRankCheckComplete?.(rankUp));
        return;
      }

      if (result.awarded) {
        updateProfileField({
          quizResultPoints: (user.profile.quizResultPoints ?? 0) + (result.totalPoints ?? rewardBreakdown.totalPoints),
        });

        // The award RPC is authoritative for the amount just added. Compare
        // it with the score snapshot from before this result, so a rank-up is
        // detected without waiting for a later profile refresh.
        const rankUpFromAward = getQuizPerformanceRankUp(
          safeCurrentTotalPoints,
          result.totalPoints ?? rewardBreakdown.totalPoints,
        );
        onRankCheckComplete?.(rankUpFromAward);

        // Refresh the shared profile and leaderboard in the background. If
        // the client snapshot was stale, the refreshed canonical rank can
        // still surface a rank-up that the immediate amount comparison missed.
        void reconcileRank().then((refreshedRankUp) => {
          if (
            refreshedRankUp &&
            (!rankUpFromAward || refreshedRankUp.rank.minPoints > rankUpFromAward.rank.minPoints)
          ) {
            onRankCheckComplete?.(refreshedRankUp);
          } else if (!rankUpFromAward) {
            onRankCheckComplete?.(null);
          }
        });
        return;
      }

      // Idempotent replays may report that this session was already awarded.
      // Refresh the canonical score and rank in that case instead of guessing
      // from a potentially stale client snapshot.
      void (async () => {
        const rankUp = await reconcileRank();
        onRankCheckComplete?.(rankUp);
      })();
    }).catch(() => {
      onAwardError?.();
      void reconcileRank().then((rankUp) => onRankCheckComplete?.(rankUp));
    });
  }, [
    input,
    onAwardError,
    onAwardPersisted,
    onRankCheckComplete,
    refreshProfile,
    rewardBreakdown,
    sessionId,
    safeCurrentTotalPoints,
    updateProfileField,
    user,
  ]);

  const beginHudExit = useCallback(() => {
    if (completionNotifiedRef.current) return;
    completionNotifiedRef.current = true;
    onRewardsFinished?.();

    if (!hudVisible || hudExiting) return;
    setHudExiting(true);
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      setHudVisible(false);
      setHudExiting(false);
    }, 320);
  }, [hudExiting, hudVisible, onRewardsFinished]);

  useEffect(() => {
    if (!entered || exiting || scheduleStartedRef.current || categories.length === 0) return;

    sequenceTimerRef.current = window.setTimeout(() => {
      if (exitingRef.current || scheduleStartedRef.current) return;
      scheduleStartedRef.current = true;
      setRequests(categories);
    }, 200);

    return () => {
      if (sequenceTimerRef.current !== null) {
        window.clearTimeout(sequenceTimerRef.current);
        sequenceTimerRef.current = null;
      }
    };
  }, [categories, entered, exiting]);

  useEffect(() => {
    if (!exiting) return;

    if (sequenceTimerRef.current !== null) {
      window.clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }

    if (hudVisible && exitTimerRef.current === null) {
      exitTimerRef.current = window.setTimeout(() => {
        exitTimerRef.current = null;
        setHudVisible(false);
        setHudExiting(false);
      }, 320);
    }
    cleanupTimerRef.current = window.setTimeout(() => {
      cleanupTimerRef.current = null;
      setRequests([]);
    }, 240);

    return () => {
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
    };
  }, [exiting, hudVisible]);

  useEffect(() => () => {
    if (sequenceTimerRef.current !== null) window.clearTimeout(sequenceTimerRef.current);
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    if (cleanupTimerRef.current !== null) window.clearTimeout(cleanupTimerRef.current);
  }, []);

  const handlePointsStart = useCallback((category: RewardCategory) => {
    if (exitingRef.current || startedCategoriesRef.current.has(category)) return;
    startedCategoriesRef.current.add(category);
    setHudVisible(true);

    const source = category === "correct" || category === "learned"
      ? document.querySelector<HTMLElement>(`[data-result-card="${category}"]`)
      : document.querySelector<HTMLElement>(`[data-result-stat="${category}"]`);
    pulseElement(source);
    playSoundEffect("quiz-result-point-award");
    vibrate("result");
  }, []);

  const handlePointsArrive = useCallback((category: RewardCategory, cumulativeAmount: number) => {
    if (exitingRef.current || cumulativeAmount <= 0) return;

    // RewardScatter reports the category's cumulative amount on every arrival.
    // Convert it to this flight's delta before adding it to the session total.
    const previousAmount = arrivedPointsByCategoryRef.current[category];
    if (cumulativeAmount <= previousAmount) return;

    const flightAmount = cumulativeAmount - previousAmount;
    arrivedPointsByCategoryRef.current[category] = cumulativeAmount;
    setArrivedPoints((current) => current + flightAmount);
    setScorePulse((current) => current + 1);
    pulseElement(document.querySelector<HTMLElement>('[data-result-stat="points"]'));
    onPointsArrive(flightAmount);
  }, [onPointsArrive]);

  const handlePointsComplete = useCallback((category: RewardCategory) => {
    if (completedCategoriesRef.current.has(category)) return;
    completedCategoriesRef.current.add(category);
    if (completedCategoriesRef.current.size < categories.length) return;

    beginHudExit();
  }, [beginHudExit, categories.length]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {hudVisible ? (
        <div
          className={exiting || hudExiting ? "animate-streak-reward-hud-exit" : "animate-streak-reward-hud-enter"}
          data-result-performance-reward-hud
          style={{
            position: "fixed",
            insetInline: 0,
            top: "1rem",
            zIndex: 260,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.25rem",
            pointerEvents: "none",
          }}
        >
          <MainPointsDisplay
            targetRef={targetRef}
            pulse={scorePulse}
            data-result-score-display
            value={formatNumber(locale, baseTotalPoints + arrivedPoints)}
          />
          <RewardGemHud animate hudRole="reward" />
        </div>
      ) : null}

      {requests.map((request) => (
        <RewardScatter
          key={request.id}
          points={{
            amount: request.amount,
            source: document.querySelector<HTMLElement>(request.id === "correct" || request.id === "learned"
              ? `[data-result-card="${request.id}"]`
              : `[data-result-stat="${request.id}"]`),
            target: targetRef,
            startDelayMs: request.startDelayMs,
            iconSize: 30,
            zIndex: 270,
            arrivalSoundEffect: "points",
            vibrateOnArrival: true,
          }}
          flightExit={exiting}
          onPointsStart={() => handlePointsStart(request.id)}
          onPointsArrive={(amount) => handlePointsArrive(request.id, amount)}
          onPointsComplete={() => handlePointsComplete(request.id)}
        />
      ))}
    </>,
    document.body,
  );
}

function pulseElement(element: HTMLElement | null) {
  if (!element) return;

  const pulseFrames: Keyframe[] = [
    { transform: "scale(1)" },
    { transform: "scale(1.075)" },
    { transform: "scale(1)" },
  ];
  if (typeof element.animate === "function") {
    element.animate(pulseFrames, {
      duration: 380,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    return;
  }

  element.classList.remove("quiz-performance-reward-pulse");
  void element.offsetWidth;
  element.classList.add("quiz-performance-reward-pulse");
  element.addEventListener("animationend", () => {
    element.classList.remove("quiz-performance-reward-pulse");
  }, { once: true });
}

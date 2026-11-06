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

const REWARD_CATEGORY_START_INTERVAL_MS = 700;
const REWARD_POINT_ARRIVAL_STAGGER_MS = 1600;
const REWARD_PULSE_SOUND_RATE_STEP = 0.2;
const REWARD_PULSE_SOUND_MAX_RATE = 2.5;
const REWARD_BOX_PULSE_DURATION_MS = 620;
const REWARD_BOX_PULSE_STRENGTH = 1;
const REWARD_BOX_PULSE_MAX_SCALE = 1.12;
const REWARD_BOX_PULSE_SCALE = 1 + (REWARD_BOX_PULSE_MAX_SCALE - 1) * REWARD_BOX_PULSE_STRENGTH;
const REWARD_BOX_PULSE_WHITENING_STRENGTH = REWARD_BOX_PULSE_MAX_SCALE > 1
  ? Math.max(0, Math.min(1, (REWARD_BOX_PULSE_SCALE - 1) / (REWARD_BOX_PULSE_MAX_SCALE - 1)))
  : 0;
const REWARD_BOX_PULSE_SEGMENT_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const REWARD_BOX_PULSE_PEAK_OFFSET = 0.35;
const REWARD_BOX_PULSE_WHITE_HOLD_OFFSET = 0.45;
const REWARD_BOX_PULSE_RELEASE_OFFSET = 0.72;
const REWARD_BOX_PULSE_ANIMATION_OPTIONS: KeyframeAnimationOptions = {
  duration: REWARD_BOX_PULSE_DURATION_MS,
  // Keep offsets tied to real time; easing belongs to each keyframe segment.
  easing: "linear",
  fill: "none",
};
const POINTS_BOX_PULSE_SCALE = 1.075;
const REWARD_PULSE_HIGHLIGHT_COLOR = "#fff";
const REWARD_PULSE_COLOR_PROPERTIES = [
  "color",
  "fill",
  "stroke",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "textEmphasisColor",
  "caretColor",
  "accentColor",
  "columnRuleColor",
  "stopColor",
  "floodColor",
  "lightingColor",
] as const;
type RewardPulseColorProperty = (typeof REWARD_PULSE_COLOR_PROPERTIES)[number];
type RewardPulsePaint = Partial<Record<RewardPulseColorProperty, string>>;
const REWARD_PULSE_OPACITY_PROPERTIES = ["opacity", "fillOpacity", "strokeOpacity"] as const;
type RewardPulseOpacityProperty = (typeof REWARD_PULSE_OPACITY_PROPERTIES)[number];
type RewardPulseOpacity = Partial<Record<RewardPulseOpacityProperty, string>>;
const activeBoxPulseAnimations = new WeakMap<Element, Animation>();
const activeBoxColorAnimations = new WeakMap<Element, Animation>();
const initialBoxPaints = new WeakMap<Element, RewardPulsePaint>();
const initialBoxOpacities = new WeakMap<Element, RewardPulseOpacity>();

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
  testMode = false,
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
  testMode?: boolean;
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
      .map(([id, amount], index) => ({
        id,
        amount,
        startDelayMs: index * REWARD_CATEGORY_START_INTERVAL_MS,
      }));
  }, [rewardBreakdown]);
  const [requests, setRequests] = useState<RewardRequest[]>([]);
  const [arrivedPoints, setArrivedPoints] = useState(0);
  const [scorePulse, setScorePulse] = useState(0);
  const [hudVisible, setHudVisible] = useState(false);
  const [hudExiting, setHudExiting] = useState(false);
  const targetRef = useRef<HTMLSpanElement>(null);
  const scheduleStartedRef = useRef(false);
  const persistStartedSessionRef = useRef<string | null>(null);
  const testRankCheckStartedRef = useRef(false);
  const rewardPulseCountRef = useRef(0);
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
    if (testMode) {
      if (!testRankCheckStartedRef.current) {
        testRankCheckStartedRef.current = true;
        onRankCheckComplete?.(null);
      }
      return;
    }
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
    testMode,
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
    pulseRewardBox(source, rewardPulseCountRef);
    vibrate("quiz-reward-pulse");
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
    pulseRewardBox(
      document.querySelector<HTMLElement>('[data-result-stat="points"]'),
      rewardPulseCountRef,
      false,
    );
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
            flightStaggerMs: REWARD_POINT_ARRIVAL_STAGGER_MS,
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

function pulseRewardBox(
  element: HTMLElement | null,
  pulseCountRef: { current: number },
  flashWhite = true,
) {
  if (!element) return;

  if (flashWhite) {
    const playbackRate = Math.min(
      REWARD_PULSE_SOUND_MAX_RATE,
      1 + pulseCountRef.current * REWARD_PULSE_SOUND_RATE_STEP,
    );
    pulseCountRef.current += 1;
    playSoundEffect("quiz-reward-box-pulse", { playbackRate });
  }

  if (typeof element.animate === "function") {
    activeBoxPulseAnimations.get(element)?.cancel();
    const pulseAnimation = element.animate(
        flashWhite
        ? [
            { transform: "scale(1)", offset: 0, easing: REWARD_BOX_PULSE_SEGMENT_EASING },
            {
              transform: `scale(${REWARD_BOX_PULSE_SCALE})`,
              offset: REWARD_BOX_PULSE_PEAK_OFFSET,
              easing: REWARD_BOX_PULSE_SEGMENT_EASING,
            },
            {
              transform: "scale(1)",
              offset: REWARD_BOX_PULSE_RELEASE_OFFSET,
              easing: REWARD_BOX_PULSE_SEGMENT_EASING,
            },
            { transform: "scale(1)" },
          ]
        : [
            { transform: "scale(1)" },
            { transform: `scale(${POINTS_BOX_PULSE_SCALE})` },
            { transform: "scale(1)" },
          ],
      flashWhite ? REWARD_BOX_PULSE_ANIMATION_OPTIONS : { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    activeBoxPulseAnimations.set(element, pulseAnimation);

    if (!flashWhite) return;

    const colorTargets = [element, ...Array.from(element.querySelectorAll("*"))];
    for (const target of colorTargets) {
      if (typeof target.animate !== "function") continue;

      const preserveTextColor = target.hasAttribute("data-result-stat-label");
      activeBoxColorAnimations.get(target)?.cancel();
      const targetStyle = window.getComputedStyle(target);
      const currentPaint = readRewardPulsePaint(targetStyle);
      const initialPaint = initialBoxPaints.get(target) ?? currentPaint;
      initialBoxPaints.set(target, initialPaint);
      const currentOpacity = readRewardPulseOpacity(targetStyle);
      const initialOpacity = initialBoxOpacities.get(target) ?? currentOpacity;
      initialBoxOpacities.set(target, initialOpacity);
      const startFrame: Keyframe = {
        offset: 0,
        easing: REWARD_BOX_PULSE_SEGMENT_EASING,
      };
      const highlightFrame: Keyframe = {
        offset: REWARD_BOX_PULSE_PEAK_OFFSET,
        easing: REWARD_BOX_PULSE_SEGMENT_EASING,
      };
      const whiteHoldFrame: Keyframe = {
        offset: REWARD_BOX_PULSE_WHITE_HOLD_OFFSET,
        easing: REWARD_BOX_PULSE_SEGMENT_EASING,
      };
      const restoreFrame: Keyframe = { offset: REWARD_BOX_PULSE_RELEASE_OFFSET };
      const finalFrame: Keyframe = {};

      for (const property of REWARD_PULSE_COLOR_PROPERTIES) {
        if (preserveTextColor && property === "color") continue;

        const currentValue = currentPaint[property];
        const initialValue = initialPaint[property] ?? currentValue;
        if (!isVisiblePulseColor(currentValue) && !isVisiblePulseColor(initialValue)) continue;

        const startValue = initialValue ?? currentValue ?? "";
        const highlightColor = getRewardPulseHighlightColor(startValue);
        startFrame[property] = startValue;
        highlightFrame[property] = highlightColor;
        whiteHoldFrame[property] = highlightColor;
        restoreFrame[property] = initialValue ?? currentValue ?? "";
        finalFrame[property] = initialValue ?? currentValue ?? "";
      }

      if (Object.keys(highlightFrame).length <= 2) continue;

      for (const property of REWARD_PULSE_OPACITY_PROPERTIES) {
        const restoreValue = initialOpacity[property] ?? "1";
        startFrame[property] = restoreValue;
        highlightFrame[property] = "1";
        whiteHoldFrame[property] = "1";
        restoreFrame[property] = restoreValue;
        finalFrame[property] = restoreValue;
      }

      const colorAnimation = target.animate(
        [startFrame, highlightFrame, whiteHoldFrame, restoreFrame, finalFrame],
        REWARD_BOX_PULSE_ANIMATION_OPTIONS,
      );
      activeBoxColorAnimations.set(target, colorAnimation);
    }
    return;
  }

  element.classList.remove("quiz-performance-reward-pulse");
  void element.offsetWidth;
  element.classList.add("quiz-performance-reward-pulse");
  element.addEventListener("animationend", () => {
    element.classList.remove("quiz-performance-reward-pulse");
  }, { once: true });
}

function readRewardPulsePaint(style: CSSStyleDeclaration): RewardPulsePaint {
  return Object.fromEntries(REWARD_PULSE_COLOR_PROPERTIES.map((property) => {
    const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const value = style.getPropertyValue(cssProperty);
    return [property, resolveRewardPulseColor(value, style.color)];
  })) as RewardPulsePaint;
}

function resolveRewardPulseColor(value: string, currentColor: string) {
  return value.trim().toLowerCase() === "currentcolor" ? currentColor : value;
}

function readRewardPulseOpacity(style: CSSStyleDeclaration): RewardPulseOpacity {
  return Object.fromEntries(REWARD_PULSE_OPACITY_PROPERTIES.map((property) => [
    property,
    style.getPropertyValue(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)),
  ])) as RewardPulseOpacity;
}

function getRewardPulseHighlightColor(currentColor: string) {
  const whiteningStrength = REWARD_BOX_PULSE_WHITENING_STRENGTH;
  if (whiteningStrength >= 1) return REWARD_PULSE_HIGHLIGHT_COLOR;
  if (whiteningStrength <= 0) return currentColor;
  return `color-mix(in srgb, ${currentColor}, ${REWARD_PULSE_HIGHLIGHT_COLOR} ${whiteningStrength * 100}%)`;
}

function isVisiblePulseColor(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (["none", "transparent", "auto"].includes(normalized)) return false;
  if (/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(normalized)) return false;
  return !/\/\s*0(?:%|\.0+)?\s*\)$/.test(normalized);
}

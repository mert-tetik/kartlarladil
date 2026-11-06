"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale, useT } from "@/i18n/locale-provider";
import { MissionListContent } from "@/features/missions/components/mission-list-content";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";

const QUIZ_FLOW_TRANSITION_MS = 360;
const QUIZ_FLOW_TRANSITION_FAILSAFE_MS = 520;
const QUIZ_FLOW_SCALE_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";

interface QuizMissionRewardsViewProps {
  visible: boolean;
  testMode?: boolean;
  onInitialClaimableAvailabilityResolved: (hasClaimableMissions: boolean) => void;
  onContinue: () => void;
  onActionPress: () => void;
}

export function QuizMissionRewardsView({
  visible,
  testMode = false,
  onInitialClaimableAvailabilityResolved,
  onContinue,
  onActionPress,
}: QuizMissionRewardsViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const [exiting, setExiting] = useState(false);
  const [pending, setPending] = useState(false);
  const continueConsumedRef = useRef(false);
  const onContinueRef = useRef(onContinue);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const title = t("quiz.missionRewardsTitle");

  useEffect(() => {
    if (!testMode) return;
    onInitialClaimableAvailabilityResolved(true);
  }, [onInitialClaimableAvailabilityResolved, testMode]);

  useLayoutEffect(() => {
    onContinueRef.current = onContinue;
  }, [onContinue]);

  useLayoutEffect(() => {
    if (!visible) return;

    const sequence = exiting
      ? [
          { element: footerRef.current, delay: 0 },
          { element: listRef.current, delay: 100 },
          { element: titleRef.current, delay: 200 },
        ]
      : [
          { element: titleRef.current, delay: 0 },
          { element: listRef.current, delay: 100 },
          { element: footerRef.current, delay: 200 },
        ];
    const animations = sequence.flatMap(({ element, delay }) => {
      if (!element || typeof element.animate !== "function") return [];

      const keyframes: Keyframe[] = exiting
        ? [{ transform: "scale(1)" }, { transform: "scale(0)" }]
        : [{ transform: "scale(0)" }, { transform: "scale(1)" }];

      return [element.animate(keyframes, {
        duration: exiting ? 160 : 320,
        delay,
        easing: QUIZ_FLOW_SCALE_EASING,
        fill: "both",
      })];
    });

    if (!exiting) {
      return () => animations.forEach((animation) => animation.cancel());
    }

    let completed = false;
    let failsafeTimer: number | null = null;
    const completeExit = () => {
      if (completed) return;
      completed = true;
      if (failsafeTimer !== null) window.clearTimeout(failsafeTimer);
      onContinueRef.current();
    };
    failsafeTimer = window.setTimeout(
      completeExit,
      animations.length > 0 ? QUIZ_FLOW_TRANSITION_FAILSAFE_MS : QUIZ_FLOW_TRANSITION_MS,
    );

    if (animations.length > 0) {
      void Promise.all(animations.map((animation) => animation.finished))
        .then(completeExit)
        .catch(() => {
          // The failsafe still advances the flow if the browser cancels an animation.
        });
    }

    return () => {
      if (failsafeTimer !== null) window.clearTimeout(failsafeTimer);
      animations.forEach((animation) => animation.cancel());
    };
  }, [exiting, visible]);

  function handleContinue() {
    if (pending || continueConsumedRef.current) return;
    continueConsumedRef.current = true;
    onActionPress();
    setExiting(true);
  }

  return (
    <section
      data-quiz-mission-rewards
      data-transition-state={!visible ? "hidden" : exiting ? "exiting" : "entering"}
      aria-hidden={!visible}
      className={cn(
        "absolute inset-0 z-50 flex min-h-0 w-full flex-col overflow-hidden bg-[var(--background)] pb-[calc(3.5rem_+_50px_+_env(safe-area-inset-bottom))] sm:pb-[calc(4rem_+_50px_+_env(safe-area-inset-bottom))]",
        !visible && "pointer-events-none invisible",
        exiting && "pointer-events-none",
      )}
    >
      <h1
        ref={titleRef}
        data-quiz-mission-rewards-title
        className={cn(
          "origin-center translate-y-[50px] px-5 pb-5 pt-[54px] text-center text-[2.1rem] font-bold leading-tight text-foreground sm:text-[2.625rem]",
          canUseSuperWater(locale) && "font-super-water",
        )}
      >
        {canUseSuperWater(locale) ? formatSuperWaterText(locale, title) : title}
      </h1>

      <div
        ref={listRef}
        data-quiz-mission-rewards-list
        className="mx-4 mb-0 min-h-0 flex-1 translate-y-[10px] scale-[0.84] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[var(--background-card)] origin-center"
      >
        <MissionListContent
          testMode={testMode}
          testSeed={1}
          claimableCount={testMode ? 4 : undefined}
          claimableFirst
          visible={visible}
          redirectWhenSignedOut={false}
          onInitialClaimableAvailabilityResolved={onInitialClaimableAvailabilityResolved}
          onPendingChange={setPending}
        />
      </div>

      <div
        ref={footerRef}
        data-quiz-mission-rewards-footer
        className="absolute inset-x-0 bottom-[40px] z-20 origin-center px-4 pb-[env(safe-area-inset-bottom)]"
      >
        <button
          type="button"
          data-quiz-mission-rewards-continue
          data-tap-vibration="firm"
          disabled={pending || exiting}
          onClick={handleContinue}
          className={cn(
            "pointer-events-auto mx-auto block h-14 w-full max-w-md rounded-2xl bg-brand px-5 text-lg font-bold uppercase text-brand-foreground shadow-[0_6px_0_var(--brand-hover)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-1 active:shadow-[0_2px_0_var(--brand-hover)] disabled:pointer-events-none disabled:opacity-60 sm:h-16",
            canUseSuperWater(locale) && "font-super-water",
          )}
        >
          {canUseSuperWater(locale)
            ? formatSuperWaterText(locale, t("quiz.continue"))
            : t("quiz.continue")}
        </button>
      </div>
    </section>
  );
}

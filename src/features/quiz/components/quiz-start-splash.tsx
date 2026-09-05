"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/locale-provider";
import { ChestIcon } from "@/features/quiz/components/chest-icon";
import { getChestLabelKey, type ChestTier } from "@/features/quiz/chest-rewards";

interface QuizStartSplashProps {
  onComplete: () => void;
  onExited?: () => void;
  selectedCount?: number;
  selectedColorClass?: string;
  selectedContentScale?: number;
  selectedChestTiers?: ChestTier[];
}

const SPLASH_REVEAL_DURATION_MS = 720;
const SPLASH_EXIT_DURATION_MS = 1200;

export function QuizStartSplash({
  onComplete,
  onExited,
  selectedCount,
  selectedColorClass,
  selectedContentScale = 1,
  selectedChestTiers,
}: QuizStartSplashProps) {
  const t = useT();
  const onCompleteRef = useRef(onComplete);
  const onExitedRef = useRef(onExited);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    onExitedRef.current = onExited;
  });

  useEffect(() => {
    const completeTimer = window.setTimeout(() => {
      onCompleteRef.current();
    }, SPLASH_REVEAL_DURATION_MS);

    const exitTimer = window.setTimeout(() => {
      setExiting(true);
      onExitedRef.current?.();
    }, SPLASH_EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(completeTimer);
      window.clearTimeout(exitTimer);
    };
  }, []);

  if (exiting) {
    return null;
  }

  return createPortal(
    <>
      {selectedCount && selectedColorClass ? (
        <div
          className={`fixed inset-0 z-[59] flex flex-col items-center justify-center gap-1 border border-white/10 text-center text-white animate-quiz-start-selection-underlay ${selectedColorClass}`}
          data-quiz-start-selection-underlay
          aria-hidden="true"
        >
          <div
            className="flex flex-col items-center justify-center gap-1"
            style={{ transform: `scale(${selectedContentScale})` }}
          >
            <span className="text-xs font-medium uppercase tracking-wide opacity-80">{t("quiz.countLabel")}</span>
            <span className="text-4xl font-bold sm:text-5xl">{selectedCount}</span>
            {selectedChestTiers ? (
              <div className="mt-1 flex flex-col items-center gap-1">
                {selectedChestTiers.map((tier) => (
                  <span key={tier} className="flex items-center gap-1 text-xs font-semibold">
                    <ChestIcon tier={tier} className="size-4 shrink-0" />
                    {t(getChestLabelKey(tier))}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-brand animate-quiz-start-splash"
        data-quiz-start-splash
        aria-hidden="true"
      >
        <span className="break-words px-6 text-center text-5xl font-black uppercase tracking-widest text-white sm:text-6xl lg:text-7xl">
          {t("quiz.startSplash")}
        </span>
      </div>
    </>,
    document.body,
  );
}

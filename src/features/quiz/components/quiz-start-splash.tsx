"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
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
    playSoundEffect("quiz-start");

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
                    <StartSplashChestIcon />
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

function StartSplashChestIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0" aria-hidden="true">
      <path d="M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" className="fill-current" />
      <path
        d="M3 9c0-1.1.9-2 2-2h14a2 2 0 0 1 2 2M3 9l3-3h12l3 3M12 9v12"
        className="stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="2" className="fill-current opacity-40" />
    </svg>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { cn } from "@/lib/utils";

interface QuizStartSplashProps {
  onComplete: () => void;
  onCovered?: () => void;
  onExited?: () => void;
}

const SPLASH_EXIT_DURATION_MS = 1400;
const SPLASH_COVERED_PROGRESS = 0.4;

export function QuizStartSplash({
  onComplete,
  onCovered,
  onExited,
}: QuizStartSplashProps) {
  const { locale, t } = useLocale();
  const onCompleteRef = useRef(onComplete);
  const onCoveredRef = useRef(onCovered);
  const onExitedRef = useRef(onExited);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    onCoveredRef.current = onCovered;
  });

  useEffect(() => {
    onExitedRef.current = onExited;
  });

  useEffect(() => {
    const coveredTimer = window.setTimeout(() => {
      onCoveredRef.current?.();
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : SPLASH_EXIT_DURATION_MS * SPLASH_COVERED_PROGRESS);

    const exitTimer = window.setTimeout(() => {
      setExiting(true);
      onCompleteRef.current();

      window.requestAnimationFrame(() => {
        onExitedRef.current?.();
      });
    }, SPLASH_EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(coveredTimer);
      window.clearTimeout(exitTimer);
    };
  }, []);

  if (exiting) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-brand animate-quiz-start-splash"
      data-quiz-start-splash
      aria-hidden="true"
    >
      <span
        className={cn(
          "break-words px-6 text-center text-5xl font-bold tracking-widest text-white sm:text-6xl lg:text-7xl",
          canUseSuperWater(locale) && "font-super-water",
        )}
      >
        {formatSuperWaterUppercaseText(locale, t("quiz.startSplash"))}
      </span>
    </div>,
    document.body,
  );
}

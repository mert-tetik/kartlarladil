"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/locale-provider";

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
  const t = useT();
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
      <span className="break-words px-6 text-center text-5xl font-black uppercase tracking-widest text-white sm:text-6xl lg:text-7xl">
        {t("quiz.startSplash")}
      </span>
    </div>,
    document.body,
  );
}

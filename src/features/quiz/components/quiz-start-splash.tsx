"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/locale-provider";

interface QuizStartSplashProps {
  onComplete: () => void;
}

const SPLASH_DURATION_MS = 1200;

export function QuizStartSplash({ onComplete }: QuizStartSplashProps) {
  const t = useT();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onComplete();
    }, SPLASH_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-brand animate-quiz-start-splash"
      data-quiz-start-splash
      aria-hidden="true"
    >
      <span className="px-6 text-center text-5xl font-black uppercase tracking-widest text-white sm:text-6xl lg:text-7xl">
        {t("quiz.startSplash")}
      </span>
    </div>,
    document.body,
  );
}

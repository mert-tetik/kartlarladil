"use client";

import { useEffect } from "react";
import { preloadWebpFrameSequence } from "@/components/webp-frame-sequence-player";
import { preloadQuizCriticalMedia } from "@/features/quiz/quiz-video-preload";

export function AppCriticalMediaPreloader() {
  useEffect(() => {
    let disposed = false;
    let quizPreloadTimer: number | null = null;

    const startQuizPreload = () => {
      if (disposed || quizPreloadTimer !== null) return;
      quizPreloadTimer = window.setTimeout(() => {
        if (!disposed) preloadQuizCriticalMedia();
      }, 0);
    };

    const startupFailsafe = window.setTimeout(startQuizPreload, 2500);
    void preloadWebpFrameSequence("tutorial-welcome", 16).finally(() => {
      window.clearTimeout(startupFailsafe);
      startQuizPreload();
    });

    return () => {
      disposed = true;
      window.clearTimeout(startupFailsafe);
      if (quizPreloadTimer !== null) window.clearTimeout(quizPreloadTimer);
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";
import { preloadQuizCriticalMedia } from "@/features/quiz/quiz-video-preload";

export function AppCriticalMediaPreloader() {
  useEffect(() => {
    preloadQuizCriticalMedia();
  }, []);

  return null;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/locale-provider";

interface GameStartSplashProps {
  onComplete: () => void;
  onExited?: () => void;
}

const SPLASH_REVEAL_DURATION_MS = 720;
const SPLASH_EXIT_DURATION_MS = 1200;

export function GameStartSplash({ onComplete, onExited }: GameStartSplashProps) {
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-brand animate-quiz-start-splash"
      data-game-start-splash
      aria-hidden="true"
    >
      <span className="break-words px-6 text-center text-5xl font-black uppercase tracking-widest text-white sm:text-6xl lg:text-7xl">
        {t("games.startSplash")}
      </span>
    </div>,
    document.body,
  );
}

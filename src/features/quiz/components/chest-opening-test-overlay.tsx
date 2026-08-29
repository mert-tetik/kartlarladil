"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";

const CHEST_OPENING_TEST_PARAM = "chest-opening-test";
const NEXT_CHEST_DELAY_MS = 1000;

/**
 * Visual-only chest loop for checking every chest asset and animation.
 * It intentionally never calls a reward/claim action.
 */
export function ChestOpeningTestOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [tierIndex, setTierIndex] = useState(0);
  const [showChest, setShowChest] = useState(true);
  const enabledTimeoutRef = useRef<number | null>(null);
  const nextChestTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested =
      params.get(CHEST_OPENING_TEST_PARAM) === "1" ||
      params.get(CHEST_OPENING_TEST_PARAM) === "true";

    enabledTimeoutRef.current = window.setTimeout(() => {
      setEnabled(requested);
    }, 0);

    return () => {
      if (enabledTimeoutRef.current !== null) {
        window.clearTimeout(enabledTimeoutRef.current);
      }
      if (nextChestTimeoutRef.current !== null) {
        window.clearTimeout(nextChestTimeoutRef.current);
      }
    };
  }, []);

  const handleChestComplete = useCallback(() => {
    setShowChest(false);
    nextChestTimeoutRef.current = window.setTimeout(() => {
      setTierIndex((currentIndex) => (currentIndex + 1) % CHEST_TIERS.length);
      setShowChest(true);
    }, NEXT_CHEST_DELAY_MS);
  }, []);

  if (!enabled || !showChest) {
    return null;
  }

  const tier = CHEST_TIERS[tierIndex % CHEST_TIERS.length]!;

  return createPortal(
    <div
      data-chest-opening-test-overlay
      data-chest-opening-test-tier={tier.tier}
      aria-label="Chest opening animation test"
      className="fixed inset-0 z-[100] overflow-hidden bg-background text-foreground"
    >
      <ChestOpeningView
        key={`${tier.tier}-${tierIndex}`}
        tier={tier}
        totalPoints={0}
        onComplete={handleChestComplete}
      />
    </div>,
    document.body,
  );
}

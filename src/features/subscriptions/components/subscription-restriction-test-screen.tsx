"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UpgradeDialog, type UpgradeDialogErrorCode } from "@/features/subscriptions/components/upgrade-dialog";

const SUBSCRIPTION_RESTRICTION_TEST_CODES = [
  "free_active_card_limit",
  "free_learned_card_limit",
  "ai_daily_limit",
  "ai_monthly_limit",
  "game_level_locked",
  "learned_review_subscription_required",
  "scenario_subscription_required",
  "image_text_translate_limit",
] as const satisfies readonly UpgradeDialogErrorCode[];

const DIALOG_EXIT_DURATION = 320;

export function SubscriptionRestrictionTestScreen() {
  const [testIndex, setTestIndex] = useState(0);
  const [open, setOpen] = useState(true);
  const nextOpenTimerRef = useRef<number | null>(null);

  const showNextRestriction = useCallback(() => {
    setTestIndex((currentIndex) => (currentIndex + 1) % SUBSCRIPTION_RESTRICTION_TEST_CODES.length);
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      setOpen(true);
      return;
    }

    setOpen(false);
    if (nextOpenTimerRef.current !== null) {
      window.clearTimeout(nextOpenTimerRef.current);
    }
    nextOpenTimerRef.current = window.setTimeout(showNextRestriction, DIALOG_EXIT_DURATION);
  }, [showNextRestriction]);

  useEffect(() => () => {
    if (nextOpenTimerRef.current !== null) {
      window.clearTimeout(nextOpenTimerRef.current);
    }
  }, []);

  const activeCode = SUBSCRIPTION_RESTRICTION_TEST_CODES[testIndex];

  return (
    <section
      className="min-h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] bg-background p-4"
      data-subscription-restriction-test-page
      data-subscription-restriction-test-code={activeCode}
    >
      <UpgradeDialog
        open={open}
        errorCode={activeCode}
        onOpenChange={handleOpenChange}
      />
    </section>
  );
}

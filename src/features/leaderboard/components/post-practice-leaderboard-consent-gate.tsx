"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { LeaderboardConsentDialog } from "@/features/leaderboard/components/leaderboard-consent-dialog";
import { useLeaderboardConsentTestMode } from "@/features/leaderboard/leaderboard-consent-test-mode";
import {
  POST_PRACTICE_NOTIFICATION_PROMPT_EVENT,
  POST_PRACTICE_TUTORIAL_COMPLETED_EVENT,
} from "@/features/push/push-client";

const AUTO_CONSENT_PROMPT_KEY_PREFIX = "foxiesdeck:leaderboard:auto-consent-prompted";

export function PostPracticeLeaderboardConsentGate() {
  const { user, updateProfileField } = useAuthSession();
  const leaderboardConsentTestMode = useLeaderboardConsentTestMode();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const dispatchNotificationPrompt = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent(POST_PRACTICE_NOTIFICATION_PROMPT_EVENT));
    });
  }, []);

  const closeAndContinue = useCallback(() => {
    setOpen(false);
    setError("");
    dispatchNotificationPrompt();
  }, [dispatchNotificationPrompt]);

  const handleConfirm = useCallback(async () => {
    if (leaderboardConsentTestMode) {
      closeAndContinue();
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/leaderboard/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: true }),
      });

      if (!response.ok) {
        throw new Error("leaderboard_consent_failed");
      }

      updateProfileField({ leaderboardVisible: true });
      closeAndContinue();
    } catch {
      setError("consent_failed");
    } finally {
      setBusy(false);
    }
  }, [closeAndContinue, leaderboardConsentTestMode, updateProfileField]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleTutorialCompleted() {
      if (!user) {
        dispatchNotificationPrompt();
        return;
      }

      if (user.profile.leaderboardVisible && !leaderboardConsentTestMode) {
        dispatchNotificationPrompt();
        return;
      }

      const storageKey = getAutoConsentPromptKey(user.id);

      if (!leaderboardConsentTestMode && window.localStorage.getItem(storageKey) === "1") {
        dispatchNotificationPrompt();
        return;
      }

      if (!leaderboardConsentTestMode) {
        window.localStorage.setItem(storageKey, "1");
      }
      setError("");
      setOpen(true);
    }

    window.addEventListener(POST_PRACTICE_TUTORIAL_COMPLETED_EVENT, handleTutorialCompleted);

    return () => {
      window.removeEventListener(POST_PRACTICE_TUTORIAL_COMPLETED_EVENT, handleTutorialCompleted);
    };
  }, [dispatchNotificationPrompt, leaderboardConsentTestMode, user]);

  return (
    <LeaderboardConsentDialog
      open={open}
      busy={busy}
      error={error}
      onClose={closeAndContinue}
      onConfirm={() => {
        void handleConfirm();
      }}
    />
  );
}

function getAutoConsentPromptKey(userId: string) {
  return `${AUTO_CONSENT_PROMPT_KEY_PREFIX}:${userId}`;
}

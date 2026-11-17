"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { useAuthSession } from "@/features/auth/auth-client";
import { PERFORMANCE_DIAGNOSTICS_COPY } from "@/features/auth/components/performance-diagnostics-copy";
import { getTwaMode } from "@/features/install-app/twa-mode";
import {
  getPerformanceDiagnosticsConsent,
  notifyPerformanceDiagnosticsConsentChanged,
} from "@/lib/performance-diagnostics";
import { PERFORMANCE_DIAGNOSTICS_POLICY_VERSION } from "@/lib/performance-diagnostics-contract";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

const EXCLUDED_PATH_PREFIXES = [
  "/login",
  "/register",
  "/reset-password",
  "/auth/",
  "/account/update-password",
  "/account/settings",
];

function isNormalAppPath(pathname: string) {
  return !EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function PerformanceDiagnosticsDisclosure() {
  const pathname = usePathname();
  const { user, isSessionReady } = useAuthSession();
  const { locale } = useLocale();
  const copy = PERFORMANCE_DIAGNOSTICS_COPY[locale];
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);
  const checkedUserIdRef = useRef<string | null>(null);
  const userId = user?.id;
  const onboardingCompleted = user?.profile.onboardingCompleted;

  useEffect(() => {
    if (!isSessionReady || !userId) {
      checkedUserIdRef.current = null;
      setOpen(false);
      return;
    }
    if (
      !onboardingCompleted
      || !isNormalAppPath(pathname)
      || !getTwaMode()
      || checkedUserIdRef.current === userId
    ) {
      if (!isNormalAppPath(pathname)) setOpen(false);
      return;
    }

    let cancelled = false;
    let retryTimer: number | null = null;
    const checkConsent = async () => {
      try {
        const consent = await getPerformanceDiagnosticsConsent(userId);
        if (cancelled) return;
        checkedUserIdRef.current = userId;
        setOpen(consent.has_decided !== true);
      } catch {
        if (!cancelled) retryTimer = window.setTimeout(() => void checkConsent(), 20_000);
      }
    };

    const initialTimer = window.setTimeout(() => void checkConsent(), 900);
    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [isSessionReady, onboardingCompleted, pathname, userId]);

  const closeDisclosure = useCallback(() => {
    setOpen(false);
    setHasError(false);
  }, []);

  const saveChoice = useCallback(async (enabled: boolean) => {
    if (isSaving) return;
    setIsSaving(true);
    setHasError(false);
    try {
      const response = await fetch("/api/analytics/performance", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled, policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION }),
      });
      if (!response.ok) throw new Error("consent_update_failed");
      checkedUserIdRef.current = userId ?? null;
      closeDisclosure();
      notifyPerformanceDiagnosticsConsentChanged(enabled, true);
    } catch {
      setHasError(true);
    } finally {
      setIsSaving(false);
    }
  }, [closeDisclosure, isSaving, userId]);

  return (
    <MobileBottomSheetShell
      open={open}
      onClose={closeDisclosure}
      presentation="centered-dialog"
      title={copy.title}
      titleId="performance-diagnostics-disclosure-title"
      panelLabel={copy.title}
      visual={<Activity className="size-6" aria-hidden="true" />}
      tone="brand"
      showPanelDecoration={false}
      showProtrusionCircle={false}
      panelClassName="bg-background-card text-foreground"
      titleClassName="text-foreground"
      contentClassName="gap-3 overflow-y-auto px-5 pb-5"
    >
      <p className="text-sm leading-6 text-foreground-secondary">{copy.description}</p>
      <p className="text-sm leading-6 text-foreground">{copy.data}</p>
      <p className="text-sm leading-6 text-foreground-secondary">{copy.storage}</p>
      <Link
        href="/privacy"
        onClick={closeDisclosure}
        className="text-sm font-semibold text-[var(--brand)] underline underline-offset-4"
      >
        {copy.privacy}
      </Link>
      {hasError ? <p className="text-sm text-red-600" role="alert">{copy.error}</p> : null}
      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          disabled={isSaving}
          onClick={() => void saveChoice(false)}
          className="w-full sm:w-auto"
        >
          {copy.notNow}
        </Button>
        <Button
          type="button"
          disabled={isSaving}
          onClick={() => void saveChoice(true)}
          className={cn("w-full sm:w-auto", isSaving && "cursor-wait")}
        >
          {isSaving ? copy.saving : copy.enable}
        </Button>
      </div>
    </MobileBottomSheetShell>
  );
}

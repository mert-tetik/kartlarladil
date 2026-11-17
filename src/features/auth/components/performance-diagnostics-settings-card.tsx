"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/i18n/locale-provider";
import { useAuthSession } from "@/features/auth/auth-client";
import { getTwaMode } from "@/features/install-app/twa-mode";
import { PERFORMANCE_DIAGNOSTICS_COPY } from "@/features/auth/components/performance-diagnostics-copy";
import {
  getPerformanceDiagnosticsConsent,
  notifyPerformanceDiagnosticsConsentChanged,
} from "@/lib/performance-diagnostics";
import { PERFORMANCE_DIAGNOSTICS_POLICY_VERSION } from "@/lib/performance-diagnostics-contract";

export function PerformanceDiagnosticsSettingsCard() {
  const { locale } = useLocale();
  const { user } = useAuthSession();
  const copy = PERFORMANCE_DIAGNOSTICS_COPY[locale];
  const [isTwa, setIsTwa] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const inTwa = getTwaMode();
    setIsTwa(inTwa);
    if (!inTwa) {
      setIsLoading(false);
      return;
    }

    if (!user?.id) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    void getPerformanceDiagnosticsConsent(user.id)
      .then((consent) => {
        if (cancelled) return;
        setEnabled(consent.enabled);
        notifyPerformanceDiagnosticsConsentChanged(consent.enabled, consent.has_decided);
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function updateConsent() {
    if (isSaving || isLoading) return;
    setIsSaving(true);
    setHasError(false);
    const nextEnabled = !enabled;
    try {
      const response = await fetch("/api/analytics/performance", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION }),
      });
      if (!response.ok) throw new Error("consent_update_failed");
      setEnabled(nextEnabled);
      notifyPerformanceDiagnosticsConsentChanged(nextEnabled, true);
    } catch {
      setHasError(true);
    } finally {
      setIsSaving(false);
    }
  }

  if (!isTwa) return null;

  return (
    <section className="rounded-lg border border-border bg-background-card p-6" aria-labelledby="performance-diagnostics-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="performance-diagnostics-title" className="text-xl font-semibold text-foreground">
            {copy.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-foreground-secondary">{copy.description}</p>
          <p className="mt-3 text-sm leading-6 text-foreground-secondary">{copy.data}</p>
          <Link href="/privacy" className="mt-3 inline-flex text-sm font-semibold text-[var(--brand)] underline underline-offset-4">
            {copy.privacy}
          </Link>
        </div>
        <span className="rounded-md border border-border px-3 py-1 text-sm font-semibold text-foreground-secondary">
          {isLoading ? copy.saving : enabled ? copy.enabled : copy.disabled}
        </span>
      </div>

      <button
        type="button"
        disabled={isLoading || isSaving}
        onClick={() => void updateConsent()}
        className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? copy.saving : enabled ? copy.disable : copy.enable}
      </button>
      {hasError ? <p className="mt-3 text-sm text-red-600" role="alert">{copy.error}</p> : null}
    </section>
  );
}

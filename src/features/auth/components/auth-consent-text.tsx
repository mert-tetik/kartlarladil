"use client";

import Link from "next/link";
import { useT } from "@/i18n/locale-provider";

export function AuthConsentText() {
  const t = useT();

  return (
    <p className="mt-3 text-center text-xs leading-relaxed text-foreground-muted">
      {t("auth.google.consentPrefix")}
      <Link href="/terms" className="underline hover:text-foreground-secondary">
        {t("auth.google.consentTerms")}
      </Link>
      {t("auth.google.consentAnd")}
      <Link href="/privacy" className="underline hover:text-foreground-secondary">
        {t("auth.google.consentPrivacy")}
      </Link>
      {t("auth.google.consentSuffix")}
    </p>
  );
}

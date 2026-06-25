"use client";

import { Button } from "@/components/ui/button";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import { TWA_PACKAGE_NAME } from "@/features/install-app/twa-mode";
import { useT } from "@/i18n/locale-provider";
import { SITE_URL } from "@/lib/constants";
import type { SubscriptionProvider } from "@/types/domain";

interface SubscriptionMismatchNoticeProps {
  provider: SubscriptionProvider;
  context: "pricing" | "settings";
}

const MESSAGES = {
  pricing: {
    twaWithLemon: "pricing.mismatch.twaWithLemon",
    webWithGooglePlay: "pricing.mismatch.webWithGooglePlay",
    openWebsite: "pricing.mismatch.openWebsite",
    openPlayStore: "pricing.mismatch.openPlayStore",
  },
  settings: {
    twaWithLemon: "account.subscription.mismatch.twaWithLemon",
    webWithGooglePlay: "account.subscription.mismatch.webWithGooglePlay",
    openWebsite: "account.subscription.mismatch.openWebsite",
    openPlayStore: "account.subscription.mismatch.openPlayStore",
  },
} as const;

export function SubscriptionMismatchNotice({ provider, context }: SubscriptionMismatchNoticeProps) {
  const t = useT();
  const isTwa = useTwaMode();
  const keys = MESSAGES[context];

  if (isTwa && provider === "lemon_squeezy") {
    const url = `${SITE_URL}/account/subscription`;
    return (
      <div className="rounded-lg border border-border bg-background-muted p-4 text-sm text-foreground-secondary">
        <p>{t(keys.twaWithLemon)}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        >
          {t(keys.openWebsite)}
        </Button>
      </div>
    );
  }

  if (!isTwa && provider === "google_play") {
    const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(TWA_PACKAGE_NAME)}`;
    return (
      <div className="rounded-lg border border-border bg-background-muted p-4 text-sm text-foreground-secondary">
        <p>{t(keys.webWithGooglePlay)}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        >
          {t(keys.openPlayStore)}
        </Button>
      </div>
    );
  }

  return null;
}

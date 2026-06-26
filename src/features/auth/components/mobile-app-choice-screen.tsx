"use client";

import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/constants";
import { useT } from "@/i18n/locale-provider";
import { TWA_PACKAGE_NAME } from "@/features/install-app/twa-mode";
import { buttonClassName } from "@/components/ui/button";

interface MobileAppChoiceScreenProps {
  onContinueOnWeb: () => void;
}

export function MobileAppChoiceScreen({ onContinueOnWeb }: MobileAppChoiceScreenProps) {
  const t = useT();
  const playStoreUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(TWA_PACKAGE_NAME)}`;

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <div className="flex items-center gap-3">
        <Logo size={48} priority />
        <span className="font-display text-3xl font-semibold text-foreground">{APP_NAME}</span>
      </div>

      <p className="mt-6 text-base leading-relaxed text-foreground-secondary">
        {t("metadata.description")}
      </p>

      <div className="mt-10 flex w-full flex-col gap-3">
        <a
          href={playStoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName("primary", "lg", "h-14 w-full text-base font-bold")}
        >
          {t("home.mobile.getFromPlayStore")}
        </a>

        <button
          type="button"
          onClick={onContinueOnWeb}
          className={buttonClassName("ghost", "lg", "h-12 w-full text-base font-semibold")}
        >
          {t("home.mobile.continueOnWeb")}
        </button>
      </div>
    </div>
  );
}

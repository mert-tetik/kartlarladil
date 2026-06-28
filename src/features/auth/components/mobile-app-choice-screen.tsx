"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/constants";
import { useT } from "@/i18n/locale-provider";
import { TWA_PACKAGE_NAME } from "@/features/install-app/twa-mode";
import {
  isAppleMobileDevice,
  isAndroidMobileDevice,
} from "@/features/install-app/device-detection";
import { buttonClassName } from "@/components/ui/button";

interface MobileAppChoiceScreenProps {
  onContinueOnWeb: () => void;
}

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.71 15.7 3.46 8.34 8.28 8.04c1.24-.07 2.17.63 2.92.63.78 0 2.03-.77 3.42-.66 1.32.11 2.2.56 2.84 1.36-2.55 1.54-2.12 5.46.22 6.52-.53 1.39-1.22 2.77-1.67 3.39zm-5.85-15.1c.07-1.74 1.5-3.28 3.2-3.18.24 2.16-1.86 3.9-3.2 3.18z" />
    </svg>
  );
}

export function MobileAppChoiceScreen({ onContinueOnWeb }: MobileAppChoiceScreenProps) {
  const t = useT();
  const playStoreUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(TWA_PACKAGE_NAME)}`;
  const isApple = isAppleMobileDevice();
  const isAndroid = isAndroidMobileDevice();

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
        {isApple ? (
          <Link
            href="/add-to-home-screen"
            className={buttonClassName(
              "primary",
              "lg",
              "h-14 w-full items-center justify-center gap-2 bg-black text-base font-bold text-white hover:bg-neutral-800",
            )}
          >
            <AppleLogo className="size-5 fill-current" />
            {t("home.mobile.addToHomeScreen")}
          </Link>
        ) : isAndroid ? (
          <a
            href={playStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClassName("primary", "lg", "h-14 w-full text-base font-bold")}
          >
            {t("home.mobile.getFromPlayStore")}
          </a>
        ) : null}

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

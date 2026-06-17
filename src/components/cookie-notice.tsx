"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";

const COOKIE_NOTICE_KEY = "foxiesdeck-cookie-notice-dismissed";

function readDismissedState() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(COOKIE_NOTICE_KEY) !== "true";
  } catch {
    return true;
  }
}

export function CookieNotice() {
  const t = useT();
  const [visible, setVisible] = useState(readDismissedState);

  function dismiss() {
    try {
      window.localStorage.setItem(COOKIE_NOTICE_KEY, "true");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={t("cookies.policy")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background-card/95 p-4 shadow-lg backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <p className="text-center text-sm text-foreground-secondary sm:text-left">
          {t("cookies.notice")}{" "}
          <Link
            href="/cookies"
            className="font-medium text-foreground underline underline-offset-2 hover:text-foreground-secondary"
          >
            {t("cookies.policy")}
          </Link>
        </p>
        <Button type="button" size="sm" onClick={dismiss} className="shrink-0">
          {t("cookies.accept")}
        </Button>
      </div>
    </div>
  );
}

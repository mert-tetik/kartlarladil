"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";

const COOKIE_NOTICE_KEY = "foxiesdeck-cookie-notice-dismissed";

function readDismissedState() {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    return window.localStorage.getItem(COOKIE_NOTICE_KEY) !== "true";
  } catch {
    return true;
  }
}

function subscribe(callback: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === COOKIE_NOTICE_KEY) {
      callback();
    }
  }

  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

export function CookieNotice() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const visible = useSyncExternalStore(
    subscribe,
    readDismissedState,
    () => true,
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMounted(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(COOKIE_NOTICE_KEY, "true");
    } catch {
      // ignore
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new StorageEvent("storage", { key: COOKIE_NOTICE_KEY }));
    }
  }

  if (!mounted || !visible) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={t("cookies.policy")}
      data-cookie-notice
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

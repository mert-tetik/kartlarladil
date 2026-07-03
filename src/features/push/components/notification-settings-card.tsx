"use client";

import { useState } from "react";
import { NotificationToggle, usePushNotifications } from "@/features/push/components/push-notifications-provider";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function NotificationSettingsCard() {
  const t = useT();
  const { supported, isTwa, enabled, permission, busy, enableNotifications, disableNotifications } = usePushNotifications();
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  const description = !isTwa
    ? t("push.settings.twaOnlyDescription")
    : permission === "denied"
      ? t("push.settings.permissionDeniedDescription")
      : enabled
        ? t("push.settings.enabledDescription")
        : t("push.settings.disabledDescription");

  async function handleToggle() {
    setMessage(null);

    const result = enabled
      ? await disableNotifications()
      : await enableNotifications();

    if (!result.message) {
      return;
    }

    setMessage(result.message);
    setMessageTone(result.ok ? "success" : "error");
  }

  return (
    <div className="rounded-lg border border-border bg-background-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t("push.settings.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-secondary">
            {description}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={t("push.settings.toggleLabel")}
          disabled={busy || !supported}
          onClick={() => void handleToggle()}
          className="shrink-0"
        >
          <NotificationToggle enabled={enabled} disabled={busy || !supported} />
        </button>
      </div>

      {message ? (
        <p
          className={cn(
            "mt-4 text-sm font-medium",
            messageTone === "success" ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { NotificationToggle, usePushNotifications } from "@/features/push/components/push-notifications-provider";
import { useT } from "@/i18n/locale-provider";
import { useAppMessage } from "@/components/app-message-provider";

export function NotificationSettingsCard() {
  const t = useT();
  const { supported, isTwa, enabled, permission, busy, enableNotifications, disableNotifications } = usePushNotifications();
  const { showMessage } = useAppMessage();

  const description = !isTwa
    ? t("push.settings.twaOnlyDescription")
    : permission === "denied"
      ? t("push.settings.permissionDeniedDescription")
      : enabled
        ? t("push.settings.enabledDescription")
        : t("push.settings.disabledDescription");

  async function handleToggle() {
    const result = enabled
      ? await disableNotifications()
      : await enableNotifications();

    if (!result.message) {
      return;
    }

    showMessage(result.message, result.ok ? "success" : "error");
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
    </div>
  );
}

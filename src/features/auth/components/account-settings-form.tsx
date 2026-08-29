"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE, type AuthShellUser } from "@/features/auth/auth-types";
import { FieldError, FormMessage, inputClassName } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useT } from "@/i18n/locale-provider";

export function AccountSettingsForm({ user }: { user: AuthShellUser }) {
  const [state, formAction] = useActionState(updateProfileAction, AUTH_ACTION_IDLE_STATE);
  const t = useT();

  return (
    <form action={formAction} className="rounded-lg border border-border bg-background-card p-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{t("auth.profile.title")}</h2>
        <p className="mt-2 text-sm leading-6 text-foreground-secondary">{t("auth.profile.description")}</p>
      </div>

      <div className="mt-6 space-y-5">
        <FormMessage state={state} />

        <label className="block">
          <span className="text-sm font-semibold text-foreground">{t("common.email")}</span>
          <input className={inputClassName} value={user.email} disabled readOnly />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-foreground">{t("common.displayName")}</span>
          <input
            className={inputClassName}
            name="displayName"
            type="text"
            defaultValue={user.profile.displayName ?? ""}
            autoComplete="name"
          />
          <FieldError message={state.fieldErrors?.displayName?.[0]} />
        </label>

        <input
          type="hidden"
          name="preferredLanguageCode"
          value={user.profile.preferredLanguageCode ?? ""}
          readOnly
        />
        <input
          type="hidden"
          name="preferredUiLocale"
          value={user.profile.preferredUiLocale ?? ""}
          readOnly
        />
        <input
          type="hidden"
          name="preferredTier"
          value={user.profile.preferredTier ?? ""}
          readOnly
        />

        <fieldset className="rounded-md border border-border bg-background px-4 py-4">
          <legend className="px-1 text-sm font-semibold text-foreground">
            {t("leaderboard.allowTitle")}
          </legend>
          <label className="mt-2 flex cursor-pointer items-center justify-between gap-4">
            <span className="text-sm leading-6 text-foreground-secondary">
              {t("leaderboard.allowDescription")}
            </span>
            <input
              className="size-5 shrink-0 accent-[var(--brand)]"
              type="checkbox"
              name="leaderboardVisible"
              value="on"
              defaultChecked={user.profile.leaderboardVisible ?? false}
            />
          </label>
        </fieldset>

        <SubmitButton pendingLabel={t("auth.profile.pending")}>{t("auth.profile.save")}</SubmitButton>
      </div>
    </form>
  );
}

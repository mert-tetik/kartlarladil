"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE, type AuthShellUser } from "@/features/auth/auth-types";
import { FieldError, FormMessage, inputClassName } from "@/features/auth/components/form-message";
import { PreferenceFields } from "@/features/auth/components/preference-fields";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useT } from "@/i18n/locale-provider";

export function AccountSettingsForm({ user }: { user: AuthShellUser }) {
  const [state, formAction] = useActionState(updateProfileAction, AUTH_ACTION_IDLE_STATE);
  const t = useT();

  return (
    <form action={formAction} className="rounded-lg border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">{t("auth.profile.title")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t("auth.profile.description")}</p>
      </div>

      <div className="mt-6 space-y-5">
        <FormMessage state={state} />

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">{t("common.email")}</span>
          <input className={inputClassName} value={user.email} disabled readOnly />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-800">{t("common.displayName")}</span>
          <input
            className={inputClassName}
            name="displayName"
            type="text"
            defaultValue={user.profile.displayName ?? ""}
            autoComplete="name"
          />
          <FieldError message={state.fieldErrors?.displayName?.[0]} />
        </label>

        <PreferenceFields
          defaultLanguage={user.profile.preferredLanguageCode ?? "en"}
          defaultUiLocale={user.profile.preferredUiLocale ?? "en"}
          defaultTier={user.profile.preferredTier ?? "A1"}
          languageError={state.fieldErrors?.preferredLanguageCode?.[0]}
          uiLocaleError={state.fieldErrors?.preferredUiLocale?.[0]}
          tierError={state.fieldErrors?.preferredTier?.[0]}
        />

        <SubmitButton pendingLabel={t("auth.profile.pending")}>{t("auth.profile.save")}</SubmitButton>
      </div>
    </form>
  );
}

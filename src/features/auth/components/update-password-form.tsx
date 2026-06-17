"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { PasswordInput } from "@/features/auth/components/password-input";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useT } from "@/i18n/locale-provider";

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, AUTH_ACTION_IDLE_STATE);
  const t = useT();

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <label className="block">
        <span className="text-sm font-semibold text-foreground">{t("common.newPassword")}</span>
        <PasswordInput name="password" autoComplete="new-password" required />
        <FieldError message={state.fieldErrors?.password?.[0]} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-foreground">{t("common.confirmNewPassword")}</span>
        <PasswordInput name="confirmPassword" autoComplete="new-password" required />
        <FieldError message={state.fieldErrors?.confirmPassword?.[0]} />
      </label>

      <SubmitButton className="w-full" pendingLabel={t("auth.updatePassword.pending")}>
        {t("auth.updatePassword.title")}
      </SubmitButton>
    </form>
  );
}

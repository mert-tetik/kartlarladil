"use client";

import { useActionState } from "react";
import { updatePasswordAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { PasswordInput } from "@/features/auth/components/password-input";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useRecoveryPasswordUpdate } from "@/features/auth/components/use-recovery-password-update";
import { useT } from "@/i18n/locale-provider";

export function UpdatePasswordForm({ isRecoveryFlow = false }: { isRecoveryFlow?: boolean }) {
  const [state, formAction] = useActionState(updatePasswordAction, AUTH_ACTION_IDLE_STATE);
  const recovery = useRecoveryPasswordUpdate();
  const t = useT();
  const activeState = isRecoveryFlow ? recovery.state : state;

  return (
    <form action={formAction} onSubmit={isRecoveryFlow ? recovery.handleSubmit : undefined} className="space-y-5">
      <FormMessage state={activeState} />

      <label className="block">
        <span className="text-sm font-semibold text-foreground">{t("common.newPassword")}</span>
        <PasswordInput name="password" autoComplete="new-password" required />
        <FieldError message={activeState.fieldErrors?.password?.[0]} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-foreground">{t("common.confirmNewPassword")}</span>
        <PasswordInput name="confirmPassword" autoComplete="new-password" required />
        <FieldError message={activeState.fieldErrors?.confirmPassword?.[0]} />
      </label>

      <SubmitButton
        className="w-full"
        pendingLabel={t("auth.updatePassword.pending")}
        pendingOverride={isRecoveryFlow ? recovery.pending : undefined}
      >
        {t("auth.updatePassword.title")}
      </SubmitButton>
    </form>
  );
}

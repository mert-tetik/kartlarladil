"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FieldError, FormMessage, inputClassName } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPasswordAction, AUTH_ACTION_IDLE_STATE);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Email</span>
        <input className={inputClassName} name="email" type="email" autoComplete="email" required />
        <FieldError message={state.fieldErrors?.email?.[0]} />
      </label>

      <SubmitButton className="w-full" pendingLabel="Gönderiliyor">
        Şifreyi sıfırla
      </SubmitButton>
    </form>
  );
}

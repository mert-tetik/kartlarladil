"use client";

import { useActionState } from "react";
import { registerAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FieldError, FormMessage, inputClassName } from "@/features/auth/components/form-message";
import { PasswordInput } from "@/features/auth/components/password-input";
import { PreferenceFields } from "@/features/auth/components/preference-fields";
import { SubmitButton } from "@/features/auth/components/submit-button";

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(registerAction, AUTH_ACTION_IDLE_STATE);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />
      <FormMessage state={state} />

      <PreferenceFields
        defaultLanguage="en"
        defaultTier="A1"
        languageError={state.fieldErrors?.preferredLanguageCode?.[0]}
        tierError={state.fieldErrors?.preferredTier?.[0]}
      />

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Görünen ad</span>
        <input className={inputClassName} name="displayName" type="text" autoComplete="name" />
        <FieldError message={state.fieldErrors?.displayName?.[0]} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Email</span>
        <input className={inputClassName} name="email" type="email" autoComplete="email" required />
        <FieldError message={state.fieldErrors?.email?.[0]} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Şifre</span>
        <PasswordInput name="password" autoComplete="new-password" required />
        <FieldError message={state.fieldErrors?.password?.[0]} />
      </label>

      <SubmitButton className="w-full" pendingLabel="Hesap açılıyor">
        Kayıt ol
      </SubmitButton>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FieldError, FormMessage, inputClassName } from "@/features/auth/components/form-message";
import { PasswordInput } from "@/features/auth/components/password-input";
import { SubmitButton } from "@/features/auth/components/submit-button";

export function LoginForm({ nextPath, message }: { nextPath: string; message?: string }) {
  const [state, formAction] = useActionState(loginAction, AUTH_ACTION_IDLE_STATE);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />
      <FormMessage message={message} />
      <FormMessage state={state} />

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Email</span>
        <input className={inputClassName} name="email" type="email" autoComplete="email" required />
        <FieldError message={state.fieldErrors?.email?.[0]} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Şifre</span>
        <PasswordInput name="password" autoComplete="current-password" required />
        <FieldError message={state.fieldErrors?.password?.[0]} />
      </label>

      <div className="flex items-center justify-between gap-3 text-sm">
        <Link href="/reset-password" className="font-semibold text-slate-700 hover:text-slate-950">
          Şifremi unuttum
        </Link>
      </div>

      <SubmitButton className="w-full" pendingLabel="Giriş yapılıyor">
        Giriş yap
      </SubmitButton>
    </form>
  );
}

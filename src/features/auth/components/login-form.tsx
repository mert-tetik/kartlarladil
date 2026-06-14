"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FieldError, FormMessage, inputClassName } from "@/features/auth/components/form-message";
import { PasswordInput } from "@/features/auth/components/password-input";
import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useT } from "@/i18n/locale-provider";

export function LoginForm({ nextPath, message }: { nextPath: string; message?: string }) {
  const [state, formAction] = useActionState(loginAction, AUTH_ACTION_IDLE_STATE);
  const t = useT();

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />
      <FormMessage message={message} />
      <FormMessage state={state} />

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">{t("common.email")}</span>
        <input className={inputClassName} name="email" type="email" autoComplete="email" required />
        <FieldError message={state.fieldErrors?.email?.[0]} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">{t("common.password")}</span>
        <PasswordInput name="password" autoComplete="current-password" required />
        <FieldError message={state.fieldErrors?.password?.[0]} />
      </label>

      <div className="flex items-center justify-between gap-3 text-sm">
        <Link href="/reset-password" className="font-semibold text-slate-700 hover:text-slate-950">
          {t("auth.login.forgotPassword")}
        </Link>
      </div>

      <SubmitButton className="w-full" pendingLabel={t("auth.login.pending")}>
        {t("auth.login.title")}
      </SubmitButton>

      <div className="relative flex items-center py-2">
        <div className="grow border-t border-slate-200" />
        <span className="mx-3 text-xs font-medium text-slate-500">{t("common.or")}</span>
        <div className="grow border-t border-slate-200" />
      </div>

      <GoogleSignInButton nextPath={nextPath} label={t("auth.google.signIn")} />
    </form>
  );
}

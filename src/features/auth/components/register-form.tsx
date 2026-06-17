"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FieldError, FormMessage, inputClassName } from "@/features/auth/components/form-message";
import { PasswordInput } from "@/features/auth/components/password-input";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useT } from "@/i18n/locale-provider";

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(registerAction, AUTH_ACTION_IDLE_STATE);
  const t = useT();

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />
      <FormMessage state={state} />

      <label className="block">
        <span className="text-sm font-semibold text-foreground">{t("common.displayName")}</span>
        <input className={inputClassName} name="displayName" type="text" autoComplete="name" />
        <FieldError message={state.fieldErrors?.displayName?.[0]} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-foreground">{t("common.email")}</span>
        <input className={inputClassName} name="email" type="email" autoComplete="email" required />
        <FieldError message={state.fieldErrors?.email?.[0]} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-foreground">{t("common.password")}</span>
        <PasswordInput name="password" autoComplete="new-password" required />
        <FieldError message={state.fieldErrors?.password?.[0]} />
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="consent"
          value="on"
          required
          className="mt-1 size-4 rounded border-border text-foreground focus:ring-foreground"
        />
        <span className="text-sm leading-6 text-foreground-secondary">
          {t("register.consentPrefix")}
          <Link href="/terms" className="font-semibold text-foreground underline hover:no-underline">
            {t("register.consentTerms")}
          </Link>
          {t("register.consentAnd")}
          <Link href="/privacy" className="font-semibold text-foreground underline hover:no-underline">
            {t("register.consentPrivacy")}
          </Link>
          {t("register.consentSuffix")}
        </span>
      </label>
      <FieldError message={state.fieldErrors?.consent?.[0]} />

      <SubmitButton className="w-full" pendingLabel={t("auth.register.pending")}>
        {t("auth.register.title")}
      </SubmitButton>
    </form>
  );
}

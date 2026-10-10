"use client";

import { useActionState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetPasswordAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FieldError, FormMessage, inputClassName } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function MobileResetPasswordForm({
  onBack,
  onLogin,
}: {
  onBack: () => void;
  onLogin: () => void;
}) {
  const t = useT();
  const [state, formAction] = useActionState(resetPasswordAction, AUTH_ACTION_IDLE_STATE);
  const inputClass = cn(inputClassName, "bg-background-muted");

  return (
    <form action={formAction} className="flex w-full flex-col">
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        data-gateway-flow-item
        data-gateway-flow-order="0"
        className="mb-4 flex h-auto items-center gap-1 self-start px-0 py-1 text-sm font-semibold text-foreground-secondary hover:bg-transparent hover:text-foreground"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
        {t("common.back")}
      </Button>

      <h2 data-gateway-flow-item data-gateway-flow-order="1" className="font-display text-2xl font-semibold text-foreground">
        {t("auth.reset.title")}
      </h2>

      <div data-gateway-flow-item data-gateway-flow-order="2" className="mt-6 flex flex-col gap-4">
        <FormMessage state={state} />

        <label className="block">
          <span className="text-sm font-semibold text-foreground">{t("common.email")}</span>
          <input className={inputClass} name="email" type="email" autoComplete="email" required />
          <FieldError message={state.fieldErrors?.email?.[0]} />
        </label>

        <SubmitButton className="mt-2 h-14 w-full text-base font-bold" pendingLabel={t("auth.reset.pending")}>
          {t("auth.reset.title")}
        </SubmitButton>
      </div>

      <button
        type="button"
        onClick={onLogin}
        data-gateway-flow-item
        data-gateway-flow-order="3"
        className="mt-4 h-auto w-full py-2 text-sm font-semibold text-foreground-secondary hover:text-foreground"
      >
        {t("auth.reset.remembered")} {t("auth.login.title")}
      </button>
    </form>
  );
}

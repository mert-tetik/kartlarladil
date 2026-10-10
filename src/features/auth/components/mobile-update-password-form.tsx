"use client";

import { useActionState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updatePasswordAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import { PasswordInput } from "@/features/auth/components/password-input";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useT } from "@/i18n/locale-provider";

export function MobileUpdatePasswordForm({ onBack }: { onBack: () => void }) {
  const t = useT();
  const [state, formAction] = useActionState(updatePasswordAction, AUTH_ACTION_IDLE_STATE);

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
        {t("auth.updatePassword.title")}
      </h2>

      <div data-gateway-flow-item data-gateway-flow-order="2" className="mt-6 flex flex-col gap-4">
        <FormMessage state={state} />

        <label className="block">
          <span className="text-sm font-semibold text-foreground">{t("common.newPassword")}</span>
          <PasswordInput name="password" autoComplete="new-password" required className="bg-background-muted" />
          <FieldError message={state.fieldErrors?.password?.[0]} />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-foreground">{t("common.confirmNewPassword")}</span>
          <PasswordInput
            name="confirmPassword"
            autoComplete="new-password"
            required
            className="bg-background-muted"
          />
          <FieldError message={state.fieldErrors?.confirmPassword?.[0]} />
        </label>

        <SubmitButton className="mt-2 h-14 w-full text-base font-bold" pendingLabel={t("auth.updatePassword.pending")}>
          {t("auth.updatePassword.title")}
        </SubmitButton>
      </div>
    </form>
  );
}

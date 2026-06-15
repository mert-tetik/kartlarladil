"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { deleteAccountAction } from "@/features/auth/actions";
import { DELETE_ACCOUNT_CONFIRMATION } from "@/features/auth/auth-schemas";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FieldError, FormMessage, inputClassName } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useT } from "@/i18n/locale-provider";

export function DeleteAccountForm({
  email,
  hasActiveSubscription,
}: {
  email: string;
  hasActiveSubscription?: boolean;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction] = useActionState(deleteAccountAction, AUTH_ACTION_IDLE_STATE);
  const t = useT();
  const confirmationMatches = confirmation.trim() === DELETE_ACCOUNT_CONFIRMATION;
  const label = useMemo(
    () => t("auth.delete.aria", { email }),
    [email, t],
  );

  return (
    <form action={formAction} className="rounded-lg border border-rose-200 bg-rose-50 p-6" aria-label={label}>
      <div>
        <h2 className="text-xl font-semibold text-rose-950">{t("auth.delete.title")}</h2>
        <p className="mt-2 text-sm leading-6 text-rose-800">{t("auth.delete.description")}</p>
      </div>

      <div className="mt-6 space-y-5">
        <FormMessage state={state} />

        {hasActiveSubscription ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            {t("auth.delete.activeSubscription")}
          </div>
        ) : null}

        <label className="block">
          <span className="text-sm font-semibold text-rose-950">
            {t("auth.delete.confirmation", { confirmation: DELETE_ACCOUNT_CONFIRMATION })}
          </span>
          <input
            className={inputClassName}
            name="confirmation"
            type="text"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
          <FieldError message={state.fieldErrors?.confirmation?.[0]} />
        </label>

        <SubmitButton
          variant="danger"
          pendingLabel={t("auth.delete.pending")}
          disabled={!confirmationMatches || hasActiveSubscription}
        >
          {t("auth.delete.submit")}
        </SubmitButton>
      </div>
    </form>
  );
}

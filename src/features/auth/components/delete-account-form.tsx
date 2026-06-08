"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { deleteAccountAction } from "@/features/auth/actions";
import { DELETE_ACCOUNT_CONFIRMATION } from "@/features/auth/auth-schemas";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FieldError, FormMessage, inputClassName } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";

export function DeleteAccountForm({ email }: { email: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction] = useActionState(deleteAccountAction, AUTH_ACTION_IDLE_STATE);
  const confirmationMatches = confirmation.trim() === DELETE_ACCOUNT_CONFIRMATION;
  const label = useMemo(() => `${email} hesabını kalıcı olarak sil`, [email]);

  return (
    <form action={formAction} className="rounded-lg border border-rose-200 bg-rose-50 p-6" aria-label={label}>
      <div>
        <h2 className="text-xl font-semibold text-rose-950">Tehlikeli alan</h2>
        <p className="mt-2 text-sm leading-6 text-rose-800">
          Hesap silme kalıcıdır. Auth kullanıcısı silinince profil, envanter ve alıştırma kayıtları cascade ile temizlenir.
        </p>
      </div>

      <div className="mt-6 space-y-5">
        <FormMessage state={state} />

        <label className="block">
          <span className="text-sm font-semibold text-rose-950">
            Onaylamak için {DELETE_ACCOUNT_CONFIRMATION} yaz
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

        <SubmitButton variant="danger" pendingLabel="Siliniyor" disabled={!confirmationMatches}>
          Hesabı kalıcı sil
        </SubmitButton>
      </div>
    </form>
  );
}

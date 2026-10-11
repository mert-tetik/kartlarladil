"use client";

import { useCallback, useState, type FormEvent } from "react";
import { AUTH_ACTION_IDLE_STATE, type AuthActionState } from "@/features/auth/auth-types";
import { createSupabaseRecoveryBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { useT } from "@/i18n/locale-provider";

export function useRecoveryPasswordUpdate() {
  const t = useT();
  const [state, setState] = useState<AuthActionState>(AUTH_ACTION_IDLE_STATE);
  const [pending, setPending] = useState(false);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    if (typeof password !== "string" || password.length < 6) {
      setState({ status: "error", message: t("auth.validation.newPasswordMin") });
      return;
    }

    if (typeof confirmPassword !== "string" || confirmPassword.length < 6) {
      setState({ status: "error", message: t("auth.validation.confirmPasswordRequired") });
      return;
    }

    if (password !== confirmPassword) {
      setState({ status: "error", message: t("auth.validation.passwordMismatch") });
      return;
    }

    if (!hasSupabaseBrowserConfig()) {
      setState({ status: "error", message: t("auth.message.notConfigured") });
      return;
    }

    setPending(true);
    setState(AUTH_ACTION_IDLE_STATE);

    try {
      const client = createSupabaseRecoveryBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();

      if (userError || !user) {
        setState({ status: "error", message: t("auth.message.passwordAuthRequired") });
        return;
      }

      const { error } = await client.auth.updateUser({ password });

      if (error) {
        setState({ status: "error", message: t("auth.message.passwordUpdateFailed") });
        return;
      }

      setState({ status: "success", message: t("auth.message.passwordUpdated") });
    } catch {
      setState({ status: "error", message: t("auth.message.passwordUpdateFailed") });
    } finally {
      setPending(false);
    }
  }, [t]);

  return { state, pending, handleSubmit };
}

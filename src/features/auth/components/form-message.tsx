"use client";

import { useEffect } from "react";
import type { AuthActionState } from "@/features/auth/auth-types";
import { useAppMessage } from "@/components/app-message-provider";
import { cn } from "@/lib/utils";

export const inputClassName =
  "h-11 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-foreground-muted focus:border-foreground-muted focus:ring-2 focus:ring-border";

export const selectClassName =
  "h-11 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition-colors focus:border-foreground-muted focus:ring-2 focus:ring-border";

export function FieldError({ message }: { message?: string }) {
  return null;
}

export function FormMessage({ state, message }: { state?: AuthActionState; message?: string }) {
  const text = message || state?.message;
  const fieldError = state?.fieldErrors
    ? Object.values(state.fieldErrors).flatMap((errors) => errors ?? [])[0]
    : undefined;
  const errorText = state?.status === "error" ? text || fieldError : undefined;
  const { showMessage } = useAppMessage();

  useEffect(() => {
    if (errorText) {
      showMessage(errorText, "error");
    }
  }, [errorText, showMessage]);

  if (!text || state?.status === "error") {
    return null;
  }

  return (
    <p
      role="status"
      className={cn(
        "rounded-md border px-3 py-2 text-sm leading-6",
        "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      {text}
    </p>
  );
}

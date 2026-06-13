"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";

export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <Button type="submit" disabled={disabled || pending} {...props}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {pendingLabel ?? t("common.loading")}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

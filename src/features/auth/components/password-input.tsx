"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClassName } from "@/features/auth/components/form-message";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  className?: string;
}

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const t = useT();
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative mt-1">
      <input className={cn(inputClassName, "pr-11", className)} type={visible ? "text" : "password"} {...props} />
      <button
        type="button"
        aria-label={visible ? t("auth.password.hide") : t("auth.password.show")}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

import type { AuthActionState } from "@/features/auth/auth-types";
import { cn } from "@/lib/utils";

export const inputClassName =
  "h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

export const selectClassName =
  "h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

export function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm font-semibold text-rose-700">{message}</p>;
}

export function FormMessage({ state, message }: { state?: AuthActionState; message?: string }) {
  const text = message || state?.message;

  if (!text) {
    return null;
  }

  const status = state?.status ?? "success";

  return (
    <p
      role={status === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm leading-6",
        status === "error" && "border-rose-200 bg-rose-50 text-rose-800",
        status !== "error" && "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      {text}
    </p>
  );
}

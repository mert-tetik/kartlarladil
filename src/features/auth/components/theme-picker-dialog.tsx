"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Lock, X } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { updateThemeAction } from "@/features/auth/actions";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { THEMES, isPaidPlan, isThemePaid, type ThemeDefinition } from "@/lib/themes";

interface ThemePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThemePickerDialog({ open, onOpenChange }: ThemePickerDialogProps) {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const { entitlements } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const effectivePlan = entitlements?.effectivePlan ?? "free";
  const isPaidUser = isPaidPlan(effectivePlan);

  if (!open) {
    return null;
  }

  function handleSelect(themeId: string) {
    if (isThemePaid(themeId) && !isPaidUser) {
      setShowUpgrade(true);
      return;
    }

    setPendingId(themeId);
    startTransition(async () => {
      const result = await updateThemeAction(themeId);

      if (result.status === "success") {
        setTheme(themeId);
      }

      setPendingId(null);
    });
  }

  function handleClose() {
    setShowUpgrade(false);
    onOpenChange(false);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-background-card p-6 shadow-xl">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground"
          aria-label={t("common.close")}
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <h2 id="theme-dialog-title" className="text-xl font-bold text-foreground">
          {t("theme.title")}
        </h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          {t("theme.current")}: <span className="font-medium text-foreground">{theme.name}</span>
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEMES.map((item) => (
            <ThemeButton
              key={item.id}
              item={item}
              selected={theme.id === item.id}
              locked={isThemePaid(item.id) && !isPaidUser}
              pending={pendingId === item.id}
              disabled={isPending}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      {showUpgrade ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowUpgrade(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-background-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">{t("theme.upgradeTitle")}</h3>
            <p className="mt-2 text-sm text-foreground-secondary">{t("theme.upgradeDescription")}</p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setShowUpgrade(false)}>
                {t("common.maybeLater")}
              </Button>
              <Link
                href="/pricing"
                className={buttonClassName("primary", "md")}
                onClick={() => {
                  setShowUpgrade(false);
                  onOpenChange(false);
                }}
              >
                {t("theme.upgradeCta")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      <LoadingOverlay show={isPending} />
    </div>,
    document.body,
  );
}

interface ThemeButtonProps {
  item: ThemeDefinition;
  selected: boolean;
  locked: boolean;
  pending: boolean;
  disabled: boolean;
  onSelect: (themeId: string) => void;
}

function ThemeButton({ item, selected, locked, pending, disabled, onSelect }: ThemeButtonProps) {
  const t = useT();
  const isDark = item.mode === "dark";

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      disabled={disabled}
      className={cn(
        "relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        selected
          ? "border-brand ring-1 ring-brand"
          : isDark
            ? "border-slate-700 hover:border-brand"
            : "border-border hover:border-brand",
        isDark ? "bg-slate-900" : "bg-background-card",
        pending && "opacity-70",
      )}
    >
      <span
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full shadow-sm"
        style={{ backgroundColor: item.brand, color: item.brandForeground }}
      >
        {locked ? <Lock className="size-3.5" aria-hidden="true" /> : null}
      </span>

      <span className="flex-1 min-w-0">
        <span className={cn("block truncate text-sm font-semibold", isDark ? "text-white" : "text-foreground")}>
          {item.name}
        </span>
        <span className={cn("block text-xs", isDark ? "text-slate-300" : "text-foreground-secondary")}>
          {isDark ? t("theme.dark") : t("theme.light")}
        </span>
      </span>

      {selected ? <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" /> : null}
    </button>
  );
}

function LoadingOverlay({ show }: { show: boolean }) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300",
        show ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="size-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
    </div>
  );
}

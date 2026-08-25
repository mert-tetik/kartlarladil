"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Lock, Palette, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { useTheme } from "@/components/theme-provider";
import { updateThemeAction } from "@/features/auth/actions";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { SubscriptionRestrictionSurface } from "@/features/subscriptions/components/subscription-restriction-surface";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
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
  const [upgradeMounted, setUpgradeMounted] = useState(false);
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  const effectivePlan = entitlements?.effectivePlan ?? "free";
  const isPaidUser = isPaidPlan(effectivePlan);

  useEffect(() => {
    if (open) {
      let enterFrame: number | null = null;
      const mountFrame = window.requestAnimationFrame(() => {
        setMounted(true);
        enterFrame = window.requestAnimationFrame(() => setEntered(true));
      });

      return () => {
        window.cancelAnimationFrame(mountFrame);
        if (enterFrame) window.cancelAnimationFrame(enterFrame);
      };
    }

    const exitFrame = window.requestAnimationFrame(() => setEntered(false));
    const timer = window.setTimeout(() => setMounted(false), 300);

    return () => {
      window.cancelAnimationFrame(exitFrame);
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (showUpgrade) {
      const frame = window.requestAnimationFrame(() => {
        setUpgradeMounted(true);
        setUpgradeVisible(true);
      });

      return () => window.cancelAnimationFrame(frame);
    }

    const exitFrame = window.requestAnimationFrame(() => setUpgradeVisible(false));
    const timer = window.setTimeout(() => setUpgradeMounted(false), 300);

    return () => {
      window.cancelAnimationFrame(exitFrame);
      window.clearTimeout(timer);
    };
  }, [showUpgrade]);

  if (!mounted || typeof document === "undefined") {
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
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 hidden items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity duration-300 lg:flex",
          entered ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        role="dialog"
        aria-modal={open}
        aria-labelledby="theme-dialog-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            handleClose();
          }
        }}
      >
        <div className="relative max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background-card p-6 shadow-xl">
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground"
            aria-label={t("common.close")}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <ThemePickerTitle id="theme-dialog-title" />
          <ThemeGrid
            selectedThemeId={theme.id}
            isPaidUser={isPaidUser}
            pendingId={pendingId}
            disabled={isPending}
            onSelect={handleSelect}
            className="mt-6"
          />
        </div>
      </div>

      <MobileBottomSheetShell
        open={open}
        onClose={handleClose}
        title={t("theme.title")}
        titleId="mobile-theme-sheet-title"
        panelLabel={t("theme.title")}
        panelClassName="max-h-[82dvh]"
        visual={<Palette className="size-[3.25rem] stroke-[2.5] text-brand-foreground" aria-hidden="true" />}
        contentClassName="overflow-y-auto px-5 pb-5"
      >
        <ThemeGrid
          selectedThemeId={theme.id}
          isPaidUser={isPaidUser}
          pendingId={pendingId}
          disabled={isPending}
          onSelect={handleSelect}
        />
      </MobileBottomSheetShell>

      {upgradeMounted || showUpgrade ? (
        <div
          className={cn(
            "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm transition-opacity duration-300 ease-out",
            upgradeVisible ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowUpgrade(false);
            }
          }}
        >
          <SubscriptionRestrictionSurface
            labelledBy="theme-upgrade-title"
            className={cn(
              "origin-center transition-[opacity,transform] duration-300 ease-out",
              upgradeVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-5 scale-[0.96] opacity-0",
            )}
          >
            <div className="absolute inset-x-0 bottom-0 flex min-h-[51%] flex-col justify-end px-[7.5%] pb-[7.5%] pt-10">
              <h3 id="theme-upgrade-title" className="text-xl font-bold leading-tight text-white sm:text-2xl">{t("theme.upgradeTitle")}</h3>
              <p className="mt-2 text-sm leading-6 text-orange-50 sm:text-base">{t("theme.upgradeDescription")}</p>

              <div className="mt-5 flex flex-col gap-2.5">
                <Link
                  href="/pricing"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#fdf4a5] to-[#f5ac27] px-4 text-sm font-bold text-[#552000] transition-[filter,transform] hover:brightness-105 active:scale-[0.98]"
                  onClick={() => {
                    setShowUpgrade(false);
                    onOpenChange(false);
                  }}
                >
                  {t("limit.upgradeButtonFirstMonthFree")}
                </Link>
                <Button
                  variant="ghost"
                  className="h-10 rounded-xl border border-white/30 bg-black/20 text-white hover:bg-black/35 hover:text-white"
                  onClick={() => setShowUpgrade(false)}
                >
                  {t("common.maybeLater")}
                </Button>
              </div>
            </div>
          </SubscriptionRestrictionSurface>
        </div>
      ) : null}
      <LoadingOverlay show={isPending} />
    </>,
    document.body,
  );
}

function ThemePickerTitle({ id, compact = false, useSuperWater = false }: { id: string; compact?: boolean; useSuperWater?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const title = t("theme.title");

  return (
    <div className="flex items-center gap-2">
      <Palette className={compact ? "size-5 text-foreground" : "size-6 text-foreground"} aria-hidden="true" />
      <h2 id={id} className={cn("font-semibold text-foreground", compact ? "text-lg" : "text-xl", useSuperWater && canUseSuperWater(locale) && "font-super-water")}>
        {useSuperWater ? formatSuperWaterText(locale, title) : title}
      </h2>
    </div>
  );
}

function ThemeGrid({
  selectedThemeId,
  isPaidUser,
  pendingId,
  disabled,
  onSelect,
  className,
}: {
  selectedThemeId: string;
  isPaidUser: boolean;
  pendingId: string | null;
  disabled: boolean;
  onSelect: (themeId: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {THEMES.map((item) => (
        <ThemeButton
          key={item.id}
          item={item}
          selected={selectedThemeId === item.id}
          locked={isThemePaid(item.id) && !isPaidUser}
          pending={pendingId === item.id}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </div>
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
        selected ? "border-brand ring-1 ring-brand" : isDark ? "border-slate-800 hover:border-brand" : "border-slate-200 hover:border-brand",
        isDark ? "bg-black" : "bg-white",
        pending && "opacity-70",
      )}
    >
      <span
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full shadow-sm"
        style={{ backgroundColor: item.brand, color: item.brandForeground }}
      >
        {locked ? <Lock className="size-3.5" aria-hidden="true" /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-semibold", isDark ? "text-white" : "text-slate-900")}>
          {item.name}
        </span>
        <span className={cn("block text-xs", isDark ? "text-slate-300" : "text-slate-500")}>
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

"use client";

import { useEffect, useRef, useState, useTransition, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Lock, Palette, X } from "lucide-react";
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
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragOffsetY = useRef(0);

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
    dragStartY.current = null;
    dragOffsetY.current = 0;
    setDragY(0);
    setIsDragging(false);
    setShowUpgrade(false);
    onOpenChange(false);
  }

  function handleDragStart(event: PointerEvent<HTMLDivElement>) {
    dragStartY.current = event.clientY;
    dragOffsetY.current = 0;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDragMove(event: PointerEvent<HTMLDivElement>) {
    if (dragStartY.current === null) return;
    const nextOffset = Math.max(0, event.clientY - dragStartY.current);
    dragOffsetY.current = nextOffset;
    setDragY(nextOffset);
  }

  function handleDragEnd() {
    const shouldClose = dragOffsetY.current > 110;
    dragStartY.current = null;
    dragOffsetY.current = 0;
    setIsDragging(false);

    if (shouldClose) {
      handleClose();
      return;
    }

    setDragY(0);
  }

  function handleDragCancel() {
    dragStartY.current = null;
    dragOffsetY.current = 0;
    setIsDragging(false);
    setDragY(0);
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

      <div
        className={cn(
          "fixed inset-0 z-50 flex flex-col justify-end transition-opacity duration-300 lg:hidden",
          entered ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        role="dialog"
        aria-modal={open}
        aria-labelledby="mobile-theme-sheet-title"
      >
        <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />
        <div
          className={cn(
            "relative flex max-h-[82dvh] flex-col rounded-t-2xl bg-background-card p-5 shadow-2xl",
            entered ? "translate-y-0" : "translate-y-full",
            isDragging ? "transition-none" : "transition-transform duration-300 ease-out",
          )}
          style={entered ? { transform: `translateY(${dragY}px)` } : undefined}
        >
          <div
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragCancel}
            className="mx-auto flex h-8 w-16 touch-none items-center justify-center"
          >
            <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
          </div>
          <div className="mb-4 flex items-center justify-between">
            <ThemePickerTitle id="mobile-theme-sheet-title" compact />
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex size-9 items-center justify-center rounded-full text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
              aria-label={t("common.close")}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pb-1">
            <ThemeGrid
              selectedThemeId={theme.id}
              isPaidUser={isPaidUser}
              pendingId={pendingId}
              disabled={isPending}
              onSelect={handleSelect}
            />
          </div>
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
    </>,
    document.body,
  );
}

function ThemePickerTitle({ id, compact = false }: { id: string; compact?: boolean }) {
  const t = useT();

  return (
    <div className="flex items-center gap-2">
      <Palette className={compact ? "size-5 text-brand" : "size-6 text-brand"} aria-hidden="true" />
      <h2 id={id} className={cn("font-semibold text-foreground", compact ? "text-lg" : "text-xl")}>
        {t("theme.title")}
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

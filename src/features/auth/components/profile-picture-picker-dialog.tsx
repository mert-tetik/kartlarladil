"use client";

import { useEffect, useRef, useState, useTransition, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { UserRound, X } from "lucide-react";
import { updateProfilePictureAction } from "@/features/auth/actions";
import { useAuthSession } from "@/features/auth/auth-client";
import { ProfilePictureOptionGrid } from "@/features/auth/components/profile-picture-option-grid";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";

interface ProfilePicturePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfilePicturePickerDialog({ open, onOpenChange }: ProfilePicturePickerDialogProps) {
  const t = useT();
  const { locale } = useLocale();
  const { user, updateProfileField } = useAuthSession();
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dragStartY = useRef<number | null>(null);
  const dragOffsetY = useRef(0);
  const selectedIndex = user?.profile.profilePictureIndex ?? 0;

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

  function handleClose() {
    dragStartY.current = null;
    dragOffsetY.current = 0;
    setDragY(0);
    setIsDragging(false);
    setError(null);
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

  function handleSelect(profilePictureIndex: number) {
    if (isPending || profilePictureIndex === selectedIndex) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateProfilePictureAction(profilePictureIndex);

      if (result.status === "success") {
        updateProfileField({ profilePictureIndex });
        handleClose();
        return;
      }

      setError(result.message);
    });
  }

  if (!mounted || typeof document === "undefined" || !user) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[80] flex flex-col justify-end transition-opacity duration-300 lg:hidden",
        entered ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      role="dialog"
      aria-modal={open}
      aria-labelledby="profile-picture-picker-title"
    >
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden="true" />
      <section
        className={cn(
          "relative flex max-h-[80dvh] flex-col rounded-t-2xl bg-background-card px-5 pb-6 shadow-sm",
          entered ? "translate-y-0" : "translate-y-full",
          isDragging ? "transition-none" : "transition-transform duration-300 ease-out",
        )}
        style={entered ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={() => {
            dragStartY.current = null;
            dragOffsetY.current = 0;
            setIsDragging(false);
            setDragY(0);
          }}
          className="mx-auto flex h-10 w-16 touch-none items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserRound className="size-5 text-foreground" aria-hidden="true" />
            <h2 id="profile-picture-picker-title" className={cn("text-lg font-semibold text-foreground", canUseSuperWater(locale) && "font-super-water")}>
              {formatSuperWaterText(locale, t("profilePicture.title"))}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex size-9 items-center justify-center rounded-full text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
            aria-label={t("common.close")}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto pb-1">
          <ProfilePictureOptionGrid selectedIndex={selectedIndex} onSelect={handleSelect} disabled={isPending} />
        </div>

        {error ? <p role="alert" className="mt-4 text-sm font-semibold text-destructive">{error}</p> : null}
      </section>
    </div>,
    document.body,
  );
}

"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { X } from "lucide-react";
import { MissionIcon } from "@/components/mission-icon";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import { MissionsList } from "./missions-list";

interface MissionsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function MissionsPanel({ open, onClose }: MissionsPanelProps) {
  const t = useT();
  const { locale } = useLocale();
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragOffsetY = useRef(0);

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

  function closePanel() {
    dragStartY.current = null;
    dragOffsetY.current = 0;
    setDragY(0);
    setIsDragging(false);
    onClose();
  }

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    dragStartY.current = event.clientY;
    dragOffsetY.current = 0;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDragMove(event: ReactPointerEvent<HTMLDivElement>) {
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
      closePanel();
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

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col justify-end transition-opacity duration-300 lg:hidden",
        entered ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <button
        type="button"
        onClick={() => {
          vibrate("tap");
          closePanel();
        }}
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-300",
          entered ? "opacity-100" : "opacity-0",
        )}
        aria-label={t("common.close")}
      />

      <div
        className={cn(
          "relative flex max-h-[calc(100dvh-var(--app-header-height))] w-full flex-col rounded-t-2xl border-t border-border bg-background shadow-sm",
          entered ? "translate-y-0" : "translate-y-full",
          isDragging ? "transition-none" : "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
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
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <MissionIcon size={24} className="h-6 w-auto" />
            <h2 className={cn("text-lg font-bold text-foreground", canUseSuperWater(locale) && "font-super-water")}>
              {formatSuperWaterText(locale, t("missions.title"))}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              vibrate("tap");
              closePanel();
            }}
            aria-label={t("common.close")}
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <MissionsList />
        </div>
      </div>
    </div>
  );
}

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

// Missions panel protrusion: edit only these values to tune its size and position.
const MISSIONS_PANEL_PROTRUSION = {
  width: 390,
  scale: 0.75,
  x: 0,
  y: 9,
  circleScale: 1.45,
  circleY: 8,
  iconY: 8,
} as const;

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
        data-missions-panel
        className={cn(
          "relative z-10 flex max-h-[calc(100dvh-var(--app-header-height)-3rem)] w-full flex-col overflow-visible rounded-t-[2rem] bg-background",
          entered ? "translate-y-0" : "translate-y-full",
          isDragging ? "transition-none" : "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
        style={entered ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          data-missions-panel-drag-handle
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragCancel}
          className="relative z-10 flex h-[4.75rem] shrink-0 touch-none select-none items-start justify-center"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 aspect-[654/151]"
            style={{
              width: `${MISSIONS_PANEL_PROTRUSION.width}px`,
              transform: `translate3d(calc(-50% + ${MISSIONS_PANEL_PROTRUSION.x}px), calc(-100% + ${MISSIONS_PANEL_PROTRUSION.y}px), 0) scale(${MISSIONS_PANEL_PROTRUSION.scale})`,
              transformOrigin: "50% 100%",
            }}
          >
            <span
              className="absolute inset-0 bg-background"
              style={{
                maskImage: "url('/missions/cikinti-v2.png')",
                WebkitMaskImage: "url('/missions/cikinti-v2.png')",
                maskPosition: "center",
                WebkitMaskPosition: "center",
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                maskSize: "100% 100%",
                WebkitMaskSize: "100% 100%",
              }}
            />
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-[28%] size-16 rounded-full bg-background-card"
              style={{
                transform: `translate3d(-50%, ${MISSIONS_PANEL_PROTRUSION.circleY}px, 0) scale(${MISSIONS_PANEL_PROTRUSION.circleScale})`,
                transformOrigin: "50% 50%",
              }}
            />
            <span
              className="absolute left-1/2 top-[28%] flex size-16 items-center justify-center"
              style={{ transform: `translate3d(-50%, ${MISSIONS_PANEL_PROTRUSION.iconY}px, 0)` }}
            >
              <MissionIcon size={52} className="size-[3.25rem]" />
            </span>
          </span>
        </div>
        <div className="relative flex shrink-0 items-center justify-center px-14 pb-3 pt-0">
          <h2 className={cn("text-lg font-bold text-foreground", canUseSuperWater(locale) && "font-super-water")}>
            {formatSuperWaterText(locale, t("missions.title"))}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              vibrate("tap");
              closePanel();
            }}
            aria-label={t("common.close")}
            className="absolute right-3 top-1"
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

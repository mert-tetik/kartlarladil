"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";

const MOBILE_BOTTOM_SHEET_PROTRUSION = {
  width: 390,
  scale: 0.75,
  x: 0,
  y: 9,
  circleScale: 1.45,
  circleY: 8,
  iconY: 8,
} as const;

const MOBILE_BOTTOM_SHEET_GRADIENT_START = "color-mix(in srgb, var(--brand) 92%, white)";
const MOBILE_BOTTOM_SHEET_CIRCLE_COLOR = "color-mix(in srgb, var(--brand) 62%, white)";

export interface MobileBottomSheetShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  visual: ReactNode;
  children: ReactNode;
  contentRef?: Ref<HTMLDivElement>;
  onEntered?: () => void;
  panelClassName?: string;
  contentClassName?: string;
  showBackdrop?: boolean;
  titleId?: string;
  panelLabel?: string;
}

export function MobileBottomSheetShell({
  open,
  onClose,
  title,
  visual,
  children,
  contentRef,
  onEntered,
  panelClassName,
  contentClassName,
  showBackdrop = true,
  titleId,
  panelLabel,
}: MobileBottomSheetShellProps) {
  const t = useT();
  const { locale } = useLocale();
  // Keep the first client render identical to the server render. The portal is
  // mounted on the next frame so opening a sheet cannot cause a hydration mismatch.
  const [mounted, setMounted] = useState(false);
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
        enterFrame = window.requestAnimationFrame(() => {
          setEntered(true);
          onEntered?.();
        });
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
  }, [onEntered, open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  function closeSheet() {
    dragStartY.current = null;
    dragOffsetY.current = 0;
    setDragY(0);
    setIsDragging(false);
    onClose();
  }

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (!open) return;
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
      closeSheet();
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

  if (!mounted || typeof document === "undefined") return null;

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col justify-end transition-opacity duration-300 lg:hidden",
        entered ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
      inert={!open}
      role="dialog"
      aria-modal={open}
      aria-label={panelLabel ?? title}
      data-mobile-bottom-sheet
    >
      <button
        type="button"
        onClick={closeSheet}
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          showBackdrop ? "bg-black/60" : "bg-transparent",
          entered ? "opacity-100" : "opacity-0",
        )}
        aria-label={t("common.close")}
      />

      <div
        ref={contentRef}
        data-mobile-bottom-sheet-panel
        className={cn(
          "relative z-10 isolate flex max-h-[calc(100dvh-var(--app-header-height)-3rem)] w-full flex-col overflow-visible rounded-t-[2rem] bg-brand text-brand-foreground shadow-sm",
          entered ? "translate-y-0" : "translate-y-full",
          isDragging ? "transition-none" : "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          panelClassName,
        )}
        style={entered ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-t-[2rem] opacity-80"
          style={{
            backgroundImage: [
              `linear-gradient(to bottom, ${MOBILE_BOTTOM_SHEET_GRADIENT_START} 0%, color-mix(in srgb, var(--brand) 97%, white) 24%, transparent 62%)`,
              "radial-gradient(circle at 12% 25%, rgb(255 255 255 / 0.2) 0, rgb(255 255 255 / 0.08) 11%, transparent 28%)",
              "radial-gradient(circle at 88% 39%, rgb(255 255 255 / 0.16) 0, rgb(255 255 255 / 0.06) 12%, transparent 30%)",
              "radial-gradient(circle at 18% 67%, rgb(255 255 255 / 0.14) 0, rgb(255 255 255 / 0.05) 12%, transparent 27%)",
              "radial-gradient(circle at 82% 82%, rgb(255 255 255 / 0.15) 0, rgb(255 255 255 / 0.05) 11%, transparent 28%)",
            ].join(", "),
          }}
        />

        <div
          data-mobile-bottom-sheet-drag-handle
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragCancel}
          className="relative z-0 flex h-[3.5rem] shrink-0 touch-none select-none items-start justify-center"
        >
          <span
            aria-hidden="true"
            data-mobile-bottom-sheet-protrusion
            className="pointer-events-none absolute left-1/2 top-0 z-0 aspect-[654/151]"
            style={{
              width: `${MOBILE_BOTTOM_SHEET_PROTRUSION.width}px`,
              transform: `translate3d(calc(-50% + ${MOBILE_BOTTOM_SHEET_PROTRUSION.x}px), calc(-100% + ${MOBILE_BOTTOM_SHEET_PROTRUSION.y}px), 0) scale(${MOBILE_BOTTOM_SHEET_PROTRUSION.scale})`,
              transformOrigin: "50% 100%",
            }}
          >
            <span
              className="absolute inset-0"
              style={{
                backgroundColor: MOBILE_BOTTOM_SHEET_GRADIENT_START,
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
              className="absolute left-1/2 top-[28%] size-16 rounded-full"
              style={{
                backgroundColor: MOBILE_BOTTOM_SHEET_CIRCLE_COLOR,
                transform: `translate3d(-50%, ${MOBILE_BOTTOM_SHEET_PROTRUSION.circleY}px, 0) scale(${MOBILE_BOTTOM_SHEET_PROTRUSION.circleScale})`,
                transformOrigin: "50% 50%",
              }}
            />
            <span
              data-mobile-bottom-sheet-visual
              className="absolute left-1/2 top-[28%] flex size-16 items-center justify-center"
              style={{ transform: `translate3d(-50%, ${MOBILE_BOTTOM_SHEET_PROTRUSION.iconY}px, 0)` }}
            >
              {visual}
            </span>
          </span>
        </div>

        <div className="relative z-10 flex shrink-0 items-center justify-center px-14 pb-2 pt-0">
          <h2
            id={titleId}
            className={cn(
              "text-center text-3xl font-bold leading-none text-brand-foreground",
              canUseSuperWater(locale) && "font-super-water",
            )}
          >
            {formatSuperWaterText(locale, title)}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeSheet}
            aria-label={t("common.close")}
            className="!size-12 absolute right-2 top-[-2.25rem] text-brand-foreground/90 hover:bg-white/15 hover:text-brand-foreground"
          >
            <X className="size-7 stroke-[3]" aria-hidden="true" />
          </Button>
        </div>

        <div className={cn("relative z-10 flex min-h-0 flex-1 flex-col", contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

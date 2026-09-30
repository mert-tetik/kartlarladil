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
const MOBILE_BOTTOM_SHEET_ANIMATION_MS = 360;
const MOBILE_BOTTOM_SHEET_ENTER_DELAY_MS = 32;
const MOBILE_BOTTOM_SHEET_OFFSCREEN_OFFSET = 80;

export type MobileBottomSheetTone = "brand" | "lime" | "purple" | "mission";

const MOBILE_BOTTOM_SHEET_TONES: Record<MobileBottomSheetTone, {
  panelClassName: string;
  foregroundClassName: string;
  closeClassName: string;
  decorationStart: string;
  decorationEnd: string;
  protrusionColor: string;
  circleColor: string;
  decorationOpacity: number;
  bottomRightGlow: string | null;
}> = {
  brand: {
    panelClassName: "bg-brand text-brand-foreground",
    foregroundClassName: "text-brand-foreground",
    closeClassName: "text-brand-foreground/90 hover:bg-white/15 hover:text-brand-foreground",
    decorationStart: MOBILE_BOTTOM_SHEET_GRADIENT_START,
    decorationEnd: "color-mix(in srgb, var(--brand) 97%, white)",
    protrusionColor: MOBILE_BOTTOM_SHEET_GRADIENT_START,
    circleColor: MOBILE_BOTTOM_SHEET_CIRCLE_COLOR,
    decorationOpacity: 0.8,
    bottomRightGlow: "radial-gradient(circle at 82% 82%, rgb(255 255 255 / 0.15) 0, rgb(255 255 255 / 0.05) 11%, transparent 28%)",
  },
  lime: {
    panelClassName: "bg-lime-400 text-lime-950",
    foregroundClassName: "text-lime-950",
    closeClassName: "text-lime-950/90 hover:bg-lime-300 hover:text-lime-950",
    decorationStart: "color-mix(in srgb, #a3e635 92%, white)",
    decorationEnd: "color-mix(in srgb, #a3e635 97%, white)",
    protrusionColor: "color-mix(in srgb, #a3e635 92%, white)",
    circleColor: "color-mix(in srgb, #a3e635 62%, white)",
    decorationOpacity: 0.8,
    bottomRightGlow: "radial-gradient(circle at 82% 82%, rgb(255 255 255 / 0.15) 0, rgb(255 255 255 / 0.05) 11%, transparent 28%)",
  },
  purple: {
    panelClassName: "bg-purple-600 text-white",
    foregroundClassName: "text-white",
    closeClassName: "text-white/90 hover:bg-white/15 hover:text-white",
    decorationStart: "color-mix(in srgb, #9333ea 92%, white)",
    decorationEnd: "color-mix(in srgb, #9333ea 97%, white)",
    protrusionColor: "color-mix(in srgb, #9333ea 92%, white)",
    circleColor: "white",
    decorationOpacity: 1,
    bottomRightGlow: null,
  },
  mission: {
    panelClassName: "bg-[#ffb833] text-[#2E240F]",
    foregroundClassName: "text-white",
    closeClassName: "text-white/90 hover:bg-white/15 hover:text-white",
    decorationStart: "color-mix(in srgb, #ffb833 92%, white)",
    decorationEnd: "color-mix(in srgb, #ffb833 97%, white)",
    protrusionColor: "#ffb833",
    circleColor: "color-mix(in srgb, #ffb833 62%, white)",
    decorationOpacity: 0.8,
    bottomRightGlow: "radial-gradient(circle at 82% 82%, rgb(255 255 255 / 0.15) 0, rgb(255 255 255 / 0.05) 11%, transparent 28%)",
  },
};

export interface MobileBottomSheetShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  visual: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  contentRef?: Ref<HTMLDivElement>;
  onEntered?: () => void;
  onExited?: () => void;
  panelClassName?: string;
  contentClassName?: string;
  showBackdrop?: boolean;
  fullScreen?: boolean;
  showPanelDecoration?: boolean;
  titleId?: string;
  titleClassName?: string;
  panelLabel?: string;
  tutorialLayer?: string;
  tone?: MobileBottomSheetTone;
}

export function MobileBottomSheetShell({
  open,
  onClose,
  title,
  visual,
  subtitle,
  children,
  contentRef,
  onEntered,
  onExited,
  panelClassName,
  contentClassName,
  showBackdrop = true,
  fullScreen = false,
  showPanelDecoration = true,
  titleId,
  titleClassName,
  panelLabel,
  tutorialLayer,
  tone = "brand",
}: MobileBottomSheetShellProps) {
  const t = useT();
  const { locale } = useLocale();
  // Keep the first client render identical to the server render. The portal is
  // mounted on the next frame so opening a sheet cannot cause a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const [hasPresented, setHasPresented] = useState(false);
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragOffsetY = useRef(0);
  const onEnteredRef = useRef(onEntered);
  const onExitedRef = useRef(onExited);
  const hasBeenOpenedRef = useRef(false);
  onEnteredRef.current = onEntered;
  onExitedRef.current = onExited;

  const toneStyles = MOBILE_BOTTOM_SHEET_TONES[tone];
  const hiddenPanelTransform = fullScreen
    ? "translateY(100%)"
    : `translateY(calc(100% + ${MOBILE_BOTTOM_SHEET_OFFSCREEN_OFFSET}px))`;

  useEffect(() => {
    if (open) {
      hasBeenOpenedRef.current = true;
      let enterFrame: number | null = null;
      let enterTimer: number | null = null;
      setHasPresented(false);
      setEntered(false);
      const mountFrame = window.requestAnimationFrame(() => {
        setMounted(true);
        // Give the browser a painted, off-screen state before changing the
        // transform. Without this separation the first frame is skipped and
        // the sheet appears to teleport into place.
        enterTimer = window.setTimeout(() => {
          enterFrame = window.requestAnimationFrame(() => {
            setHasPresented(true);
            void document.body.offsetHeight;
            enterFrame = window.requestAnimationFrame(() => {
              setEntered(true);
              onEnteredRef.current?.();
            });
          });
        }, MOBILE_BOTTOM_SHEET_ENTER_DELAY_MS);
      });

      return () => {
        window.cancelAnimationFrame(mountFrame);
        if (enterFrame !== null) window.cancelAnimationFrame(enterFrame);
        if (enterTimer !== null) window.clearTimeout(enterTimer);
      };
    }

    if (!hasBeenOpenedRef.current) return;

    const exitFrame = window.requestAnimationFrame(() => setEntered(false));
    const timer = window.setTimeout(() => {
      setMounted(false);
      hasBeenOpenedRef.current = false;
      onExitedRef.current?.();
    }, MOBILE_BOTTOM_SHEET_ANIMATION_MS);

    return () => {
      window.cancelAnimationFrame(exitFrame);
      window.clearTimeout(timer);
    };
  }, [open]);

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
        "fixed inset-0 z-50 flex flex-col lg:hidden",
        fullScreen ? "justify-start" : "justify-end",
        hasPresented ? "visible" : "invisible pointer-events-none",
      )}
      aria-hidden={!open}
      inert={!open}
      role="dialog"
      aria-modal={open}
      aria-label={panelLabel ?? title}
      data-mobile-bottom-sheet
      data-tutorial-layer={tutorialLayer}
    >
      <button
        type="button"
        onClick={closeSheet}
        className={cn("absolute inset-0", showBackdrop ? "bg-black/60" : "bg-transparent")}
        aria-label={t("common.close")}
      />

      <div
        ref={contentRef}
        data-mobile-bottom-sheet-panel
        className={cn(
        "relative z-10 isolate flex w-full flex-col shadow-sm",
          fullScreen
            ? "h-full max-h-none overflow-hidden rounded-none"
            : "max-h-[calc(100dvh-var(--app-header-height)-3rem)] overflow-visible rounded-t-[2rem]",
          isDragging ? "transition-none" : "transition-transform duration-[360ms] ease-[cubic-bezier(0.85,0,0.15,1)]",
          toneStyles.panelClassName,
          panelClassName,
        )}
        style={{ transform: entered ? `translateY(${dragY}px)` : hiddenPanelTransform }}
      >
        {showPanelDecoration && !fullScreen ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-t-[2rem]"
            style={{
              opacity: toneStyles.decorationOpacity,
              backgroundImage: [
                `linear-gradient(to bottom, ${toneStyles.decorationStart} 0%, ${toneStyles.decorationEnd} 24%, transparent 62%)`,
                "radial-gradient(circle at 12% 25%, rgb(255 255 255 / 0.2) 0, rgb(255 255 255 / 0.08) 11%, transparent 28%)",
                "radial-gradient(circle at 88% 39%, rgb(255 255 255 / 0.16) 0, rgb(255 255 255 / 0.06) 12%, transparent 30%)",
                "radial-gradient(circle at 18% 67%, rgb(255 255 255 / 0.14) 0, rgb(255 255 255 / 0.05) 12%, transparent 27%)",
                toneStyles.bottomRightGlow,
              ].filter((background): background is string => Boolean(background)).join(", "),
            }}
          />
        ) : null}

        {!fullScreen ? (
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
              backgroundColor: toneStyles.protrusionColor,
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
                  backgroundColor: toneStyles.circleColor,
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
        ) : null}

        <div
          className={cn(
            "relative z-10 flex shrink-0 items-center justify-center px-14 pb-2 pt-0",
            fullScreen && "justify-start border-b border-border bg-background-card/80 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]",
          )}
        >
          {fullScreen && visual ? (
            <span
              data-mobile-bottom-sheet-visual
              className="mr-3 flex size-10 shrink-0 items-center justify-center rounded-full bg-background-muted text-foreground [&>svg]:!size-6"
            >
              {visual}
            </span>
          ) : null}
          <div className={cn("flex min-w-0 flex-col", fullScreen ? "h-12 items-start justify-center pr-12" : "items-center")}>
            <h2
              id={titleId}
              className={cn(
                "text-center text-3xl font-bold leading-none",
                toneStyles.foregroundClassName,
                titleClassName,
                fullScreen && "text-left text-xl text-foreground",
                canUseSuperWater(locale) && "font-super-water",
              )}
            >
              {formatSuperWaterText(locale, title)}
            </h2>
            {subtitle ? <div className="mt-2 w-full">{subtitle}</div> : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeSheet}
            aria-label={t("common.close")}
            className={cn(
              "!size-12 absolute",
              toneStyles.closeClassName,
              fullScreen
                ? "right-2 top-[calc(env(safe-area-inset-top)+0.75rem)] text-foreground hover:bg-background-muted hover:text-foreground"
                : "right-2 top-[-2.25rem]",
            )}
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

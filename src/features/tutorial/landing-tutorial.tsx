"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/locale-provider";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { getTargetForStep, type TutorialTarget } from "@/features/tutorial/tutorial-targets";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 1023;
const SPOTLIGHT_PADDING = 18;
const VIEWPORT_GAP = 16;
const MESSAGE_WIDTH = 296;
const MESSAGE_HEIGHT = 84;
const NEXT_BUTTON_HEIGHT = 56;
const NEXT_BUTTON_GAP = 12;

const STEP_MESSAGE_KEYS = [
  "tutorial.landingDrawRandom",
  "tutorial.landingCreateCustom",
  "tutorial.landingCards",
  "tutorial.landingStartLearning",
  "tutorial.landingReviewLearned",
  "tutorial.landingRank",
  "tutorial.landingLeaderboard",
  "tutorial.landingGames",
] as const;

const NEXT_COLORS = [
  "bg-emerald-500 hover:bg-emerald-600",
  "bg-blue-500 hover:bg-blue-600",
  "bg-red-500 hover:bg-red-600",
  "bg-amber-400 hover:bg-amber-500",
] as const;

const RECTANGULAR_TARGETS = new Set<TutorialTarget["key"]>([
  "landing-card-center",
  "start-learning",
  "repeat-learned",
]);

interface SpotlightPosition {
  target: TutorialTarget;
  shape: "circle" | "rectangle";
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  radius: number;
  messageTop: number;
  nextTop: number;
}

export function LandingTutorial() {
  const pathname = usePathname();
  const t = useT();
  const active = useTutorialStore((state) => state.active);
  const completed = useTutorialStore((state) => state.completed);
  const step = useTutorialStore((state) => state.step);
  const testMode = useTutorialStore((state) => state.testMode);
  const advance = useTutorialStore((state) => state.advance);
  const reset = useTutorialStore((state) => state.reset);
  const enableTestMode = useTutorialStore((state) => state.enableTestMode);
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState<SpotlightPosition | null>(null);
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const isVisible = testMode || (active && !completed);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if ((params.get("tutorial-test") === "1" || params.get("tutorial-debug") === "1") && !testMode) {
      reset();
      enableTestMode();
    }
  }, [enableTestMode, pathname, reset, testMode]);

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
    setIsMobile(mobile);

    const state = useTutorialStore.getState();
    const shouldRender = state.testMode || (state.active && !state.completed);
    const target = getTargetForStep(state.step, window.location.pathname);

    if (!mobile || !shouldRender || !target) {
      setPosition(null);
      return;
    }

    const element = findVisibleElement(target.selector);
    if (!element) {
      setPosition(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = Math.hypot(rect.width, rect.height) / 2 + SPOTLIGHT_PADDING;
    const shape = RECTANGULAR_TARGETS.has(target.key) ? "rectangle" : "circle";
    const left = shape === "rectangle" ? rect.left - SPOTLIGHT_PADDING : centerX - radius;
    const top = shape === "rectangle" ? rect.top - SPOTLIGHT_PADDING : centerY - radius;
    const width = shape === "rectangle" ? rect.width + SPOTLIGHT_PADDING * 2 : radius * 2;
    const height = shape === "rectangle" ? rect.height + SPOTLIGHT_PADDING * 2 : radius * 2;
    const calloutHeight = MESSAGE_HEIGHT + NEXT_BUTTON_GAP + NEXT_BUTTON_HEIGHT;
    const messageTop = centerY > viewportHeight / 2
      ? clamp(top - calloutHeight - VIEWPORT_GAP, VIEWPORT_GAP, viewportHeight - calloutHeight - VIEWPORT_GAP)
      : clamp(top + height + VIEWPORT_GAP, VIEWPORT_GAP, viewportHeight - calloutHeight - VIEWPORT_GAP);

    setPosition({
      target,
      shape,
      left,
      top,
      width,
      height,
      centerX,
      centerY,
      radius,
      messageTop,
      nextTop: messageTop + MESSAGE_HEIGHT + NEXT_BUTTON_GAP,
    });
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(updatePosition);
    const timerIds = [100, 250, 600].map((delay) => window.setTimeout(updatePosition, delay));
    const observer = new MutationObserver(updatePosition);

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style", "aria-hidden"],
      childList: true,
      subtree: true,
    });
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      timerIds.forEach((timerId) => window.clearTimeout(timerId));
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [active, completed, step, pathname, testMode, updatePosition]);

  useEffect(() => {
    if (position) {
      nextButtonRef.current?.focus({ preventScroll: true });
    }
  }, [position, step]);

  if (!isVisible || !isMobile || pathname !== "/" || !position) {
    return null;
  }

  const mask = `radial-gradient(circle ${position.radius}px at ${position.centerX}px ${position.centerY}px, transparent ${Math.max(0, position.radius - 1)}px, #000 ${position.radius}px)`;
  const buttonLabel = step === STEP_MESSAGE_KEYS.length - 1 ? t("tutorial.understood") : t("tutorial.next");

  function blockUnderlyingInteraction(event: SyntheticEvent) {
    const target = event.target as Element;
    if (!target.closest("[data-landing-tutorial-next]")) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <div
      data-landing-tutorial
      role="dialog"
      aria-modal="true"
      aria-label={t(STEP_MESSAGE_KEYS[step] ?? STEP_MESSAGE_KEYS[0])}
      className="fixed inset-0 z-[200] touch-none"
      onPointerDownCapture={blockUnderlyingInteraction}
      onClickCapture={blockUnderlyingInteraction}
      onWheelCapture={blockUnderlyingInteraction}
    >
      {position.shape === "circle" ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/80"
          style={{ maskImage: mask, WebkitMaskImage: mask } as CSSProperties}
        />
      ) : (
        <>
          <div aria-hidden="true" data-landing-tutorial-rect-mask className="fixed left-0 right-0 top-0 bg-black/80" style={{ height: position.top }} />
          <div aria-hidden="true" data-landing-tutorial-rect-mask className="fixed left-0 bg-black/80" style={{ top: position.top, width: position.left, height: position.height }} />
          <div aria-hidden="true" data-landing-tutorial-rect-mask className="fixed right-0 bg-black/80" style={{ top: position.top, left: position.left + position.width, height: position.height }} />
          <div aria-hidden="true" data-landing-tutorial-rect-mask className="fixed bottom-0 left-0 right-0 bg-black/80" style={{ top: position.top + position.height }} />
        </>
      )}
      <div
        aria-hidden="true"
        data-landing-tutorial-spotlight
        data-spotlight-shape={position.shape}
        className={cn(
          "pointer-events-none fixed border-2 border-red-500 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_28px_rgba(239,68,68,0.55)]",
          position.shape === "circle" ? "rounded-full" : "rounded-lg",
        )}
        style={{
          left: position.left,
          top: position.top,
          width: position.width,
          height: position.height,
        }}
      />
      <p
        data-landing-tutorial-message
        className={cn(
          "pointer-events-none fixed z-10 rounded-lg px-4 py-3 text-center text-base font-semibold leading-snug text-white shadow-sm",
          NEXT_COLORS[step % NEXT_COLORS.length],
        )}
        style={{
          left: "50%",
          top: position.messageTop,
          width: `min(${MESSAGE_WIDTH}px, calc(100vw - ${VIEWPORT_GAP * 2}px))`,
          transform: "translateX(-50%)",
        }}
      >
        {t(STEP_MESSAGE_KEYS[step] ?? STEP_MESSAGE_KEYS[0])}
      </p>
      <button
        ref={nextButtonRef}
        type="button"
        data-landing-tutorial-next
        onClick={advance}
        className={cn(
          "fixed left-4 right-4 z-20 h-14 rounded-lg text-base font-bold text-white shadow-sm transition-colors active:scale-[0.98] focus:outline-none focus-visible:outline-none",
          NEXT_COLORS[step % NEXT_COLORS.length],
        )}
        style={{ top: position.nextTop }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function findVisibleElement(selector: string) {
  return Array.from(document.querySelectorAll(selector)).find((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    for (let current: Element | null = element; current; current = current.parentElement) {
      const style = window.getComputedStyle(current);
      if (current.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden") {
        return false;
      }
    }

    return true;
  }) ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

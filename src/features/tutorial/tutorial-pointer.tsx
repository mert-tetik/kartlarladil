"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/locale-provider";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { getTargetForStep, type TutorialTarget } from "@/features/tutorial/tutorial-targets";

const MOBILE_BREAKPOINT = 1023;
const POINTER_SIZE = 48;
const POINTER_HOTSPOT_X = 22;
const POINTER_HOTSPOT_Y = 16;
const VIEWPORT_EDGE_GAP = 4;
const MESSAGE_EDGE_GAP = 12;
const MESSAGE_WIDTH = 224;
const MESSAGE_HEIGHT = 96;
const SUPPRESSED_PATH_PREFIXES = ["/pricing", "/ask", "/ai-practice", "/practice", "/learn", "/learned"];

interface ResolvedTutorialTarget {
  target: TutorialTarget;
  element: Element;
}

interface PointerPosition {
  left: number;
  top: number;
  step: number;
  targetKey: string;
  messageLeft: number;
  messageTop: number;
  messageWidth: number;
}

export function TutorialPointer() {
  const pathname = usePathname();
  const active = useTutorialStore((state) => state.active);
  const completed = useTutorialStore((state) => state.completed);
  const step = useTutorialStore((state) => state.step);
  const testMode = useTutorialStore((state) => state.testMode);
  const advance = useTutorialStore((state) => state.advance);
  const reset = useTutorialStore((state) => state.reset);
  const enableTestMode = useTutorialStore((state) => state.enableTestMode);
  const setShowPostPracticeTutorial = useTutorialStore((state) => state.setShowPostPracticeTutorial);
  const t = useT();
  const [position, setPosition] = useState<PointerPosition | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const isTestUrl = params.get("tutorial-test") === "1" || params.get("tutorial-debug") === "1";
    if (isTestUrl && !testMode) {
      reset();
      enableTestMode();
    }
  }, [pathname, testMode, reset, enableTestMode]);

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
    setIsMobile(mobile);
    const currentState = useTutorialStore.getState();
    const currentPathname = window.location.pathname;

    if (
      !mobile ||
      (!currentState.testMode && (!currentState.active || currentState.completed)) ||
      isSuppressedPath(currentPathname)
    ) {
      setPosition(null);
      return;
    }

    const resolvedTarget = resolveRenderedTutorialTarget(
      currentState.step,
      currentPathname,
    );
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    if (!resolvedTarget) {
      setPosition(null);
      return;
    }

    const rect = resolvedTarget.element.getBoundingClientRect();
    const left = clamp(
      rect.left + rect.width / 2 - POINTER_HOTSPOT_X,
      VIEWPORT_EDGE_GAP,
      Math.max(VIEWPORT_EDGE_GAP, viewportWidth - POINTER_SIZE - VIEWPORT_EDGE_GAP),
    );
    const top = clamp(
      rect.top + rect.height / 2 - POINTER_HOTSPOT_Y + (resolvedTarget.target.pointerOffsetY ?? 0),
      VIEWPORT_EDGE_GAP,
      Math.max(VIEWPORT_EDGE_GAP, viewportHeight - POINTER_SIZE - VIEWPORT_EDGE_GAP),
    );
    const message = getMessagePosition({
      left,
      top,
      viewportWidth,
      viewportHeight,
    });
    setPosition({
      left,
      top,
      step: currentState.step,
      targetKey: resolvedTarget.target.key,
      ...message,
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const frameId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frameId);
  }, [completed, pathname, step, updatePosition]);

  useEffect(() => {
    if (!position) {
      return;
    }

    setShowPostPracticeTutorial(true);
  }, [position, setShowPostPracticeTutorial]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const frameId = requestAnimationFrame(updatePosition);
    const settleTimerIds = [80, 180, 360, 720].map((delay) => window.setTimeout(updatePosition, delay));
    const intervalId = window.setInterval(updatePosition, 250);
    let mutationFrameId: number | null = null;
    const viewport = window.visualViewport;
    const schedulePositionUpdate = () => {
      if (mutationFrameId !== null) {
        cancelAnimationFrame(mutationFrameId);
      }
      mutationFrameId = requestAnimationFrame(updatePosition);
    };
    const observer =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(schedulePositionUpdate);

    observer?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "class", "data-tutorial-target", "inert", "style"],
    });

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    viewport?.addEventListener("resize", updatePosition);
    viewport?.addEventListener("scroll", updatePosition);

    return () => {
      cancelAnimationFrame(frameId);
      window.clearInterval(intervalId);
      settleTimerIds.forEach((timerId) => window.clearTimeout(timerId));
      if (mutationFrameId !== null) {
        cancelAnimationFrame(mutationFrameId);
      }
      observer?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      viewport?.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("scroll", updatePosition);
    };
  }, [updatePosition]);

  useEffect(() => {
    function handleClick(event: PointerEvent) {
      const currentState = useTutorialStore.getState();
      if (
        window.innerWidth > MOBILE_BREAKPOINT ||
        (!currentState.testMode && (!currentState.active || currentState.completed)) ||
        isSuppressedPath(window.location.pathname)
      ) {
        return;
      }

      const target = getTargetForStep(currentState.step, window.location.pathname);
      if (!target) return;
      if (target.advanceOnClick === false) return;

      const element = findVisibleElement(target.selector);
      if (!element) return;
      if (target.step !== currentState.step) return;
      if (isTargetObscuredByOverlay(element)) return;
      if (
        (target.key !== "start-learning" && element.getAttribute("aria-disabled") === "true") ||
        (element as HTMLButtonElement).disabled
      ) {
        return;
      }

      if (element === event.target || element.contains(event.target as Node)) {
        advance();
      }
    }

    window.addEventListener("pointerdown", handleClick, true);
    return () => window.removeEventListener("pointerdown", handleClick, true);
  }, [advance]);

  if ((!testMode && (!active || completed)) || !isMobile || isSuppressedPath(pathname)) {
    return null;
  }

  if (!position) {
    return null;
  }

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed z-[101] rounded-lg border border-border bg-background-card px-3 py-2 text-sm font-semibold leading-5 text-foreground shadow-sm"
        data-tutorial-message
        data-tutorial-message-target={position.targetKey}
        style={{
          left: position.messageLeft,
          top: position.messageTop,
          width: position.messageWidth,
        }}
      >
        {t(getTutorialMessageKey(position.targetKey))}
      </div>
      <Image
        src="/pointer-icon.png"
        alt=""
        aria-hidden="true"
        width={48}
        height={48}
        className="tutorial-pointer"
        data-tutorial-pointer
        data-tutorial-step={position.step}
        data-tutorial-target-key={position.targetKey}
        style={{ left: position.left, top: position.top }}
        unoptimized
      />
    </>
  );
}

function getTutorialMessageKey(targetKey: string) {
  const keys = {
    "landing-draw-cards": "tutorial.drawCards",
    "tier-choice": "tutorial.chooseTier",
    "draw-cards-action": "tutorial.drawCardsAction",
    "draw-card-result": "tutorial.viewDrawnCards",
    "card-add": "tutorial.addCard",
    "card-draw-navbar-back": "tutorial.returnHome",
    "landing-learning-cards": "tutorial.viewLearningCards",
    "close-collection-menu": "tutorial.closeCollection",
    "create-card": "tutorial.createCard",
    "create-card-navbar-back": "tutorial.backFromCreateCard",
    "rank-info": "tutorial.viewRank",
    "close-rank-menu": "tutorial.closeRank",
    "leaderboard": "tutorial.openLeaderboard",
    "leaderboard-navbar-back": "tutorial.backFromLeaderboard",
    "start-learning": "tutorial.startLearning",
  } as const;

  return keys[targetKey as keyof typeof keys] ?? "tutorial.drawCards";
}

function getMessagePosition({
  left,
  top,
  viewportWidth,
  viewportHeight,
}: {
  left: number;
  top: number;
  viewportWidth: number;
  viewportHeight: number;
}) {
  const messageWidth = Math.min(MESSAGE_WIDTH, Math.max(160, viewportWidth - MESSAGE_EDGE_GAP * 2));
  const pointerCenterX = left + POINTER_SIZE / 2;
  const pointerCenterY = top + POINTER_SIZE / 2;
  const spaces = {
    right: viewportWidth - (left + POINTER_SIZE) - MESSAGE_EDGE_GAP,
    left: left - MESSAGE_EDGE_GAP,
    bottom: viewportHeight - (top + POINTER_SIZE) - MESSAGE_EDGE_GAP,
    top: top - MESSAGE_EDGE_GAP,
  };
  const side = (Object.entries(spaces).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "bottom") as keyof typeof spaces;

  if (side === "right" || side === "left") {
    return {
      messageWidth,
      messageLeft: side === "right"
        ? clamp(left + POINTER_SIZE + MESSAGE_EDGE_GAP, MESSAGE_EDGE_GAP, viewportWidth - messageWidth - MESSAGE_EDGE_GAP)
        : clamp(left - messageWidth - MESSAGE_EDGE_GAP, MESSAGE_EDGE_GAP, viewportWidth - messageWidth - MESSAGE_EDGE_GAP),
      messageTop: clamp(pointerCenterY - MESSAGE_HEIGHT / 2, MESSAGE_EDGE_GAP, viewportHeight - MESSAGE_HEIGHT - MESSAGE_EDGE_GAP),
    };
  }

  return {
    messageWidth,
    messageLeft: clamp(pointerCenterX - messageWidth / 2, MESSAGE_EDGE_GAP, viewportWidth - messageWidth - MESSAGE_EDGE_GAP),
    messageTop: side === "bottom"
      ? clamp(top + POINTER_SIZE + MESSAGE_EDGE_GAP, MESSAGE_EDGE_GAP, viewportHeight - MESSAGE_HEIGHT - MESSAGE_EDGE_GAP)
      : clamp(top - MESSAGE_HEIGHT - MESSAGE_EDGE_GAP, MESSAGE_EDGE_GAP, viewportHeight - MESSAGE_HEIGHT - MESSAGE_EDGE_GAP),
  };
}

function resolveRenderedTutorialTarget(step: number, pathname: string): ResolvedTutorialTarget | null {
  if (typeof document === "undefined" || step < 0) return null;

  const target = getTargetForStep(step, pathname);
  if (!target) return null;

  const element = findVisibleElement(target.selector);
  if (!element || !isElementVisible(element)) return null;
  if (isTargetObscuredByOverlay(element)) return null;

  return { target, element };
}

function findVisibleElement(selector: string) {
  return Array.from(document.querySelectorAll(selector)).find(isElementVisible) ?? null;
}

function isTargetObscuredByOverlay(element: Element): boolean {
  if (typeof document === "undefined") return false;

  const overlays = document.querySelectorAll(
    '[role="dialog"]:not([aria-hidden="true"]):not([inert]), ' +
      '[role="menu"]:not([aria-hidden="true"]):not([inert]), ' +
      '[role="listbox"]:not([aria-hidden="true"]):not([inert]), ' +
      '[data-mobile-auth-gateway]:not([aria-hidden="true"]):not([inert]), ' +
      '[data-mobile-tier-selector]:not([aria-hidden="true"]):not([inert]), ' +
      '[data-cookie-notice]:not([aria-hidden="true"]):not([inert])',
  );

  for (const overlay of overlays) {
    if (isElementVisible(overlay) && !overlay.contains(element)) {
      return true;
    }
  }

  return false;
}

function isElementVisible(element: Element) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  for (let current: Element | null = element; current; current = current.parentElement) {
    if (current.hasAttribute("inert") || current.getAttribute("aria-hidden") === "true") {
      return false;
    }

    const style = window.getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      style.pointerEvents === "none"
    ) {
      return false;
    }
  }

  return true;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isSuppressedPath(pathname: string) {
  return SUPPRESSED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

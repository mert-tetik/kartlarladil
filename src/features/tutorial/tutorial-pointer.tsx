"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { getTargetForStep, type TutorialTarget } from "@/features/tutorial/tutorial-targets";

const MOBILE_BREAKPOINT = 1023;
const POINTER_SIZE = 48;
const POINTER_HOTSPOT_X = 22;
const POINTER_HOTSPOT_Y = 16;
const VIEWPORT_EDGE_GAP = 4;
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
}

export function TutorialPointer() {
  const pathname = usePathname();
  const completed = useTutorialStore((state) => state.completed);
  const step = useTutorialStore((state) => state.step);
  const testMode = useTutorialStore((state) => state.testMode);
  const advance = useTutorialStore((state) => state.advance);
  const enableTestMode = useTutorialStore((state) => state.enableTestMode);
  const [position, setPosition] = useState<PointerPosition | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const isTestUrl = params.get("tutorial-test") === "1" || params.get("tutorial-debug") === "1";
    if (isTestUrl && !testMode) {
      enableTestMode();
    }
  }, [pathname, testMode, enableTestMode]);

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
    setIsMobile(mobile);
    const currentState = useTutorialStore.getState();
    const currentPathname = window.location.pathname;

    if (!mobile || (!currentState.testMode && currentState.completed) || isSuppressedPath(currentPathname)) {
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
      rect.top + rect.height / 2 - POINTER_HOTSPOT_Y,
      VIEWPORT_EDGE_GAP,
      Math.max(VIEWPORT_EDGE_GAP, viewportHeight - POINTER_SIZE - VIEWPORT_EDGE_GAP),
    );
    setPosition({
      left,
      top,
      step: currentState.step,
      targetKey: resolvedTarget.target.key,
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const frameId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frameId);
  }, [completed, pathname, step, updatePosition]);

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
      if (window.innerWidth > MOBILE_BREAKPOINT || (!currentState.testMode && currentState.completed) || isSuppressedPath(window.location.pathname)) {
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

  if ((!testMode && completed) || !isMobile || isSuppressedPath(pathname)) {
    return null;
  }

  if (!position) {
    return null;
  }

  return (
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
  );
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

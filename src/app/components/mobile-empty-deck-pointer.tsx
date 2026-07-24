"use client";

import { useCallback, useEffect, useState } from "react";
import { MousePointer2 } from "lucide-react";

const MOBILE_BREAKPOINT = 1023;
const POINTER_SIZE = 48;
const POINTER_OFFSET_BELOW_TARGET = 5;
const BLOCKING_LAYER_SELECTOR = [
  "[data-landing-tutorial]",
  "[data-subscription-purchase-success-dialog]",
  '[data-mobile-auth-gateway]:not([aria-hidden="true"]):not([inert])',
  '[data-mobile-tier-selector]:not([aria-hidden="true"]):not([inert])',
  '[data-cookie-notice]:not([aria-hidden="true"]):not([inert])',
  '[data-app-image-cache-gate]',
].join(", ");

interface PointerPosition {
  left: number;
  top: number;
}

export function MobileEmptyDeckPointer({ enabled }: { enabled: boolean }) {
  const [position, setPosition] = useState<PointerPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!enabled || window.innerWidth > MOBILE_BREAKPOINT || hasBlockingLayer()) {
      setPosition(null);
      return;
    }

    const target = document.querySelector<HTMLElement>('[data-tutorial-target="landing-draw-cards"]');
    if (!target || !isVisible(target)) {
      setPosition(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    setPosition({
      left: rect.left + rect.width / 2 - POINTER_SIZE / 2,
      // Keep the cursor slightly below the draw action instead of covering it.
      top: rect.bottom - POINTER_OFFSET_BELOW_TARGET,
    });
  }, [enabled]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(updatePosition);
    const observer = new MutationObserver(updatePosition);

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-hidden", "class", "inert", "style"],
      childList: true,
      subtree: true,
    });
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  if (!position) {
    return null;
  }

  return (
    <MousePointer2
      aria-hidden="true"
      data-mobile-empty-deck-pointer
      data-testid="mobile-empty-deck-pointer"
      className="tutorial-pointer pointer-events-none text-black"
      style={{ left: position.left, top: position.top, zIndex: 45 }}
    />
  );
}

function hasBlockingLayer() {
  return Array.from(document.querySelectorAll<HTMLElement>(BLOCKING_LAYER_SELECTOR)).some(isVisible);
}

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  for (let current: Element | null = element; current; current = current.parentElement) {
    const style = window.getComputedStyle(current);
    if (
      current.hasAttribute("inert") ||
      current.getAttribute("aria-hidden") === "true" ||
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

"use client";

import { useEffect, useState } from "react";
import { MousePointer2 } from "lucide-react";

const BLOCKING_LAYER_SELECTOR = [
  "[data-landing-tutorial]",
  "[data-subscription-purchase-success-dialog]",
  '[data-mobile-auth-gateway]:not([aria-hidden="true"]):not([inert])',
  '[data-mobile-tier-selector]:not([aria-hidden="true"]):not([inert])',
  '[data-cookie-notice]:not([aria-hidden="true"]):not([inert])',
  "[data-app-image-cache-gate]",
].join(", ");

export function MobileEmptyDeckPointer({ enabled }: { enabled: boolean }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    function updateBlockedState() {
      setBlocked(hasBlockingLayer());
    }

    updateBlockedState();
    const observer = new MutationObserver(updateBlockedState);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-hidden", "class", "inert", "style"],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  if (!enabled || blocked) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      data-mobile-empty-deck-pointer
      data-testid="mobile-empty-deck-pointer"
      className="pointer-events-none absolute left-1/2 top-[calc(100%-5px)] z-20 -translate-x-1/2"
    >
      <MousePointer2 className="empty-deck-pointer text-black" />
    </span>
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
      style.opacity === "0"
    ) {
      return false;
    }
  }

  return true;
}

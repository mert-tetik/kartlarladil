"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

const BLOCKING_LAYER_SELECTOR = [
  "[data-landing-tutorial]",
  "[data-subscription-purchase-success-dialog]",
  '[role="dialog"][aria-modal="true"]',
  '[data-mobile-auth-gateway]:not([aria-hidden="true"]):not([inert])',
  '[data-mobile-tier-selector]:not([aria-hidden="true"]):not([inert])',
  '[data-cookie-notice]:not([aria-hidden="true"]):not([inert])',
  "[data-app-image-cache-gate]",
  "[data-mobile-gateway-bootstrap]",
].join(", ");

export function MobileEmptyDeckPointer({
  enabled,
  anchorRef,
}: {
  enabled: boolean;
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const [blocked, setBlocked] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const markerRef = useRef<HTMLSpanElement>(null);

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

  useLayoutEffect(() => {
    if (!anchorRef || !enabled || blocked) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      if (hasBlockingLayer()) {
        setPosition(null);
        return;
      }

      const anchor = anchorRef.current ?? markerRef.current?.parentElement;
      const rect = anchor?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        setPosition(null);
        return;
      }

      setPosition({
        left: rect.left + rect.width / 2 - 24.6,
        top: rect.top + 22,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updatePosition);
    if (anchorRef.current) {
      resizeObserver?.observe(anchorRef.current);
    }

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      resizeObserver?.disconnect();
    };
  }, [anchorRef, blocked, enabled]);

  const marker = (
    <span
      ref={markerRef}
      aria-hidden="true"
      className="pointer-events-none absolute size-px opacity-0"
    />
  );

  if (!enabled || blocked) {
    return null;
  }

  if (!anchorRef) {
    return <PointerImage className="empty-deck-pointer-anchor pointer-events-none absolute z-[60]" />;
  }

  if (!position || typeof document === "undefined") {
    return marker;
  }

  return (
    <>
      {marker}
      {createPortal(
        <PointerImage
          className="empty-deck-pointer-anchor pointer-events-none fixed z-[80]"
          style={{ left: position.left, top: position.top }}
        />,
        document.body,
      )}
    </>
  );
}

function PointerImage({
  className,
  style,
}: {
  className: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      data-mobile-empty-deck-pointer
      data-testid="mobile-empty-deck-pointer"
      className={className}
      style={style}
    >
      <Image
        alt=""
        aria-hidden="true"
        className="empty-deck-pointer-image"
        height={64}
        priority
        src="/pointer-icon.png"
        width={64}
      />
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

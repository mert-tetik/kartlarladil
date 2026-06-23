"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const ALWAYS_LOCKED_PATHS = [
  "/ai-practice",
  "/ask",
];

const MOBILE_ONLY_LOCKED_PATHS = [
  "/card-draw",
  "/learn",
  "/my-cards",
];

const MOBILE_BREAKPOINT_MEDIA_QUERY = "(max-width: 1023px)";

function pathMatches(path: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function shouldLockBodyScroll(path: string, mobileViewport: boolean): boolean {
  return (
    pathMatches(path, ALWAYS_LOCKED_PATHS) ||
    (mobileViewport && pathMatches(path, MOBILE_ONLY_LOCKED_PATHS))
  );
}

function isInsideScrollableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  let node: HTMLElement | null = target;
  while (node && node !== document.body) {
    const role = node.getAttribute("role");
    if (role === "dialog" || role === "alertdialog") return true;
    const overflow = getComputedStyle(node).overflowY;
    if (
      (overflow === "auto" || overflow === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

export function BodyScrollLock() {
  const pathname = usePathname();
  const scrollYRef = useRef(0);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia(MOBILE_BREAKPOINT_MEDIA_QUERY).matches;
  });
  const locked = shouldLockBodyScroll(pathname, isMobileViewport);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_MEDIA_QUERY);

    function updateViewportState() {
      setIsMobileViewport(mediaQuery.matches);
    }

    updateViewportState();
    mediaQuery.addEventListener("change", updateViewportState);

    return () => {
      mediaQuery.removeEventListener("change", updateViewportState);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const body = document.body;
    const html = document.documentElement;

    if (!locked) {
      body.style.overflow = "";
      body.style.overscrollBehavior = "";
      body.style.touchAction = "";
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.height = "";
      html.style.overflow = "";
      html.style.overscrollBehavior = "";
      html.style.touchAction = "";
      return;
    }

    scrollYRef.current = window.scrollY;
    window.scrollTo(0, 0);

    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.touchAction = "none";
    body.style.position = "fixed";
    body.style.top = "0px";
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.height = "100%";
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    html.style.touchAction = "none";

    function preventTouchMove(e: TouchEvent) {
      if (isInsideScrollableElement(e.target)) return;
      e.preventDefault();
    }

    document.addEventListener("touchmove", preventTouchMove, { passive: false });

    return () => {
      document.removeEventListener("touchmove", preventTouchMove);
      body.style.overflow = "";
      body.style.overscrollBehavior = "";
      body.style.touchAction = "";
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      body.style.height = "";
      html.style.overflow = "";
      html.style.overscrollBehavior = "";
      html.style.touchAction = "";
      if (!locked) {
        window.scrollTo(0, scrollYRef.current);
      }
    };
  }, [locked]);

  return null;
}

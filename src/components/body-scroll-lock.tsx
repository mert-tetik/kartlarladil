"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const LOCKED_PATHS = [
  "/learn",
  "/card-draw",
  "/ai-practice",
  "/ask",
];

function isScrollLocked(path: string): boolean {
  return LOCKED_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
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
  const locked = isScrollLocked(pathname);
  const scrollYRef = useRef(0);

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

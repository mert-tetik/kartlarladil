"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";

const MOBILE_BREAKPOINT = 1023;
const POINTER_SIZE = 48;
const POINTER_HOTSPOT_X = 22;
const POINTER_HOTSPOT_Y = 16;
const VIEWPORT_EDGE_GAP = 4;

interface PointerPosition {
  left: number;
  top: number;
}

export function GamesNavPointer() {
  const showGamesPointer = useTutorialStore((state) => state.showGamesPointer);
  const setShowGamesPointer = useTutorialStore((state) => state.setShowGamesPointer);
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState<PointerPosition | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncViewport = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      setPosition(null);
      return;
    }

    if (!showGamesPointer || !isMobile) {
      setPosition(null);
      return;
    }

    const nav = document.querySelector("[data-mobile-main-nav]");
    const target = document.querySelector("[data-games-nav-target]");

    if (!nav || !target || !isElementVisible(nav) || !isElementVisible(target)) {
      setPosition(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

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

    setPosition({ left, top });
  }, [showGamesPointer, isMobile]);

  useEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const frameId = requestAnimationFrame(updatePosition);
    const timers = [80, 180, 360, 720].map((delay) => window.setTimeout(updatePosition, delay));
    const intervalId = window.setInterval(updatePosition, 250);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);

    return () => {
      cancelAnimationFrame(frameId);
      timers.forEach((id) => window.clearTimeout(id));
      window.clearInterval(intervalId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [updatePosition]);

  useEffect(() => {
    if (!showGamesPointer) return;

    function handlePointerDown(event: PointerEvent) {
      const target = document.querySelector("[data-games-nav-target]");
      if (!target) return;
      if (target === event.target || target.contains(event.target as Node)) {
        setShowGamesPointer(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [showGamesPointer, setShowGamesPointer]);

  if (!showGamesPointer || !isMobile || !position) {
    return null;
  }

  return (
    <Image
      src="/pointer-icon.png"
      alt=""
      aria-hidden="true"
      width={POINTER_SIZE}
      height={POINTER_SIZE}
      className="tutorial-pointer"
      data-games-pointer
      style={{ left: position.left, top: position.top }}
      unoptimized
    />
  );
}

function isElementVisible(element: Element): boolean {
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
      style.opacity === "0"
    ) {
      return false;
    }
  }

  return true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

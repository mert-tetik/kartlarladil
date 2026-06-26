"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { getTargetForStep, isTargetPage } from "@/features/tutorial/tutorial-targets";

const MOBILE_BREAKPOINT = 1023;
const POINTER_SIZE = 48;
const POINTER_OFFSET = 56;

export function TutorialPointer() {
  const pathname = usePathname();
  const completed = useTutorialStore((state) => state.completed);
  const step = useTutorialStore((state) => state.step);
  const advance = useTutorialStore((state) => state.advance);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
    setIsMobile(mobile);

    if (!mobile || completed) {
      setPosition(null);
      return;
    }

    const target = getTargetForStep(step, pathname);
    if (!target) {
      setPosition(null);
      return;
    }

    const element = document.querySelector(target.selector);
    if (!element) {
      setPosition(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const left = rect.left + rect.width / 2 - POINTER_SIZE / 2;
    const top = rect.top - POINTER_OFFSET;
    setPosition({ left, top });
  }, [completed, pathname, step]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const frameId = requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    function handleClick(event: PointerEvent) {
      if (completed) return;

      const target = getTargetForStep(step, pathname);
      if (!target) return;

      const element = document.querySelector(target.selector);
      if (!element) return;

      if (element === event.target || element.contains(event.target as Node)) {
        advance();
      }
    }

    window.addEventListener("pointerdown", handleClick, true);
    return () => window.removeEventListener("pointerdown", handleClick, true);
  }, [advance, completed, pathname, step]);

  if (completed || !isMobile || !position || !isTargetPage(pathname)) {
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
      style={{ left: position.left, top: position.top }}
      unoptimized
    />
  );
}

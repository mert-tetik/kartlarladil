"use client";

import { useEffect } from "react";
import { vibrate } from "@/lib/vibration";

export function GlobalTapVibration() {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const clickable = target.closest<HTMLElement>(
        "button, a, [role='button'], [data-clickable]",
      );
      if (!clickable) return;

      if (clickable instanceof HTMLButtonElement && clickable.disabled) return;
      if (clickable.getAttribute("aria-disabled") === "true") return;
      if (clickable.dataset.noTapVibrate !== undefined) return;

      vibrate("tap");
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return null;
}

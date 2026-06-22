"use client";

import { useEffect } from "react";
import { vibrate } from "@/lib/vibration";

export function GlobalTapVibration() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented) return;

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

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";
import { playFlowButtonSound } from "@/lib/flow-button-sound";
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

      const isTutorialControl = Boolean(clickable.closest(
        "[data-landing-tutorial-welcome-next], [data-landing-tutorial-choice], [data-landing-tutorial-next]",
      ));

      const isTutorialInteraction = Boolean(
        document.querySelector("[data-landing-tutorial]")
        || clickable.closest("[data-tutorial-layer], [data-tutorial-layer-portal]"),
      );
      if (isTutorialInteraction) {
        if (clickable.dataset.noFlowButtonSound === undefined) {
          playFlowButtonSound("tutorial");
        }
      } else if (clickable.closest("[data-flow-button-sound='auth']")) {
        if (clickable.dataset.noFlowButtonSound === undefined) {
          playFlowButtonSound("auth");
        }
      }

      if (isTutorialControl || clickable.dataset.noTapVibrate !== undefined) return;

      const hasFirmTapScope = clickable.closest<HTMLElement>("[data-tap-vibration='firm']");

      vibrate(isTutorialInteraction || hasFirmTapScope ? "firm-tap" : "tap");
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}

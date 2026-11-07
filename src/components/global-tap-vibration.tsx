"use client";

import { useEffect } from "react";
import { playFlowButtonSound } from "@/lib/flow-button-sound";
import { vibrate } from "@/lib/vibration";

export function GlobalTapVibration() {
  useEffect(() => {
    const authFlowControlsVibrated = new WeakSet<HTMLElement>();

    function handleAuthFlowClickCapture(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const clickable = target.closest<HTMLElement>(
        "button, a, [role='button'], [data-clickable]",
      );
      if (!clickable) return;
      if (clickable instanceof HTMLButtonElement && clickable.disabled) return;
      if (clickable.getAttribute("aria-disabled") === "true") return;

      const isTutorialInteraction = Boolean(
        document.querySelector("[data-landing-tutorial]")
        || clickable.closest("[data-tutorial-layer], [data-tutorial-layer-portal]"),
      );
      if (clickable.dataset.noFlowButtonSound === undefined) {
        if (isTutorialInteraction) {
          playFlowButtonSound("tutorial");
        } else if (clickable.closest("[data-flow-button-sound='auth']")) {
          playFlowButtonSound("auth");
        }
      }

      if (
        !clickable.closest(
          "[data-mobile-auth-gateway], [data-mobile-onboarding-mode], [data-onboarding-form]",
        )
      ) return;

      const isTutorialControl = Boolean(clickable.closest(
        "[data-landing-tutorial-welcome-next], [data-landing-tutorial-choice], [data-landing-tutorial-next]",
      ));
      if (isTutorialControl || clickable.dataset.noTapVibrate !== undefined) return;

      authFlowControlsVibrated.add(clickable);
      vibrate("firm-tap");
    }

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

      if (isTutorialControl || clickable.dataset.noTapVibrate !== undefined) return;

      // Auth/onboarding controls vibrate during capture so their haptic is not
      // lost when a form or component prevents the click's default action.
      // Keep the regular click handler from vibrating them a second time.
      if (authFlowControlsVibrated.delete(clickable)) return;

      const hasFirmTapScope = clickable.closest<HTMLElement>("[data-tap-vibration='firm']");

      vibrate(isTutorialInteraction || hasFirmTapScope ? "firm-tap" : "tap");
    }

    document.addEventListener("click", handleAuthFlowClickCapture, true);
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleAuthFlowClickCapture, true);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}

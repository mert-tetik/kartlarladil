"use client";

import { useEffect, useState } from "react";
import {
  TUTORIAL_CARD_LAYER_ADD_ATTEMPTED_EVENT,
  TUTORIAL_CARD_LAYER_CLOSED_EVENT,
  TUTORIAL_CARD_LAYER_OPENED_EVENT,
  type TutorialCardLayer,
  type TutorialCardLayerAddAttemptedDetail,
  type TutorialCardLayerClosedDetail,
  type TutorialCardLayerOpenedDetail,
} from "@/features/tutorial/tutorial-card-session";

const ADDED_CARDS_POINTER_THRESHOLD = 3;

export function useTutorialCardCloseGuidance(layer: TutorialCardLayer) {
  const [shouldShowPointer, setShouldShowPointer] = useState(false);

  useEffect(() => {
    let sessionIsActive = false;
    let attemptedCardCount = 0;

    function handleLayerOpened(event: Event) {
      const detail = (event as CustomEvent<TutorialCardLayerOpenedDetail>).detail;
      if (detail?.layer !== layer) return;

      sessionIsActive = true;
      attemptedCardCount = 0;
      setShouldShowPointer(false);
    }

    function handleAddAttempted(event: Event) {
      const detail = (event as CustomEvent<TutorialCardLayerAddAttemptedDetail>).detail;
      if (!sessionIsActive || detail?.layer !== layer || !Number.isInteger(detail.count) || detail.count <= 0) return;

      attemptedCardCount += detail.count;
      if (attemptedCardCount >= ADDED_CARDS_POINTER_THRESHOLD) {
        setShouldShowPointer(true);
      }
    }

    function handleLayerClosed(event: Event) {
      const detail = (event as CustomEvent<TutorialCardLayerClosedDetail>).detail;
      if (detail?.layer !== layer) return;

      sessionIsActive = false;
      attemptedCardCount = 0;
      setShouldShowPointer(false);
    }

    window.addEventListener(TUTORIAL_CARD_LAYER_OPENED_EVENT, handleLayerOpened);
    window.addEventListener(TUTORIAL_CARD_LAYER_ADD_ATTEMPTED_EVENT, handleAddAttempted);
    window.addEventListener(TUTORIAL_CARD_LAYER_CLOSED_EVENT, handleLayerClosed);

    return () => {
      window.removeEventListener(TUTORIAL_CARD_LAYER_OPENED_EVENT, handleLayerOpened);
      window.removeEventListener(TUTORIAL_CARD_LAYER_ADD_ATTEMPTED_EVENT, handleAddAttempted);
      window.removeEventListener(TUTORIAL_CARD_LAYER_CLOSED_EVENT, handleLayerClosed);
    };
  }, [layer]);

  return shouldShowPointer;
}

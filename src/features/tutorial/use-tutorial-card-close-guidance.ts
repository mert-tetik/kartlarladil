"use client";

import { useEffect, useState } from "react";
import {
  TUTORIAL_CARD_LAYER_CARDS_ADDED_EVENT,
  TUTORIAL_CARD_LAYER_CLOSED_EVENT,
  TUTORIAL_CARD_LAYER_OPENED_EVENT,
  type TutorialCardLayer,
  type TutorialCardLayerCardsAddedDetail,
  type TutorialCardLayerClosedDetail,
  type TutorialCardLayerOpenedDetail,
} from "@/features/tutorial/tutorial-card-session";

const ADDED_CARDS_POINTER_THRESHOLD = 3;

export function useTutorialCardCloseGuidance(layer: TutorialCardLayer) {
  const [shouldShowPointer, setShouldShowPointer] = useState(false);

  useEffect(() => {
    let sessionIsActive = false;
    let addedCardCount = 0;

    function handleLayerOpened(event: Event) {
      const detail = (event as CustomEvent<TutorialCardLayerOpenedDetail>).detail;
      if (detail?.layer !== layer) return;

      sessionIsActive = true;
      addedCardCount = 0;
      setShouldShowPointer(false);
    }

    function handleCardsAdded(event: Event) {
      const detail = (event as CustomEvent<TutorialCardLayerCardsAddedDetail>).detail;
      if (!sessionIsActive || detail?.layer !== layer || !Number.isInteger(detail.count) || detail.count <= 0) return;

      addedCardCount += detail.count;
      if (addedCardCount >= ADDED_CARDS_POINTER_THRESHOLD) {
        setShouldShowPointer(true);
      }
    }

    function handleLayerClosed(event: Event) {
      const detail = (event as CustomEvent<TutorialCardLayerClosedDetail>).detail;
      if (detail?.layer !== layer) return;

      sessionIsActive = false;
      addedCardCount = 0;
      setShouldShowPointer(false);
    }

    window.addEventListener(TUTORIAL_CARD_LAYER_OPENED_EVENT, handleLayerOpened);
    window.addEventListener(TUTORIAL_CARD_LAYER_CARDS_ADDED_EVENT, handleCardsAdded);
    window.addEventListener(TUTORIAL_CARD_LAYER_CLOSED_EVENT, handleLayerClosed);

    return () => {
      window.removeEventListener(TUTORIAL_CARD_LAYER_OPENED_EVENT, handleLayerOpened);
      window.removeEventListener(TUTORIAL_CARD_LAYER_CARDS_ADDED_EVENT, handleCardsAdded);
      window.removeEventListener(TUTORIAL_CARD_LAYER_CLOSED_EVENT, handleLayerClosed);
    };
  }, [layer]);

  return shouldShowPointer;
}

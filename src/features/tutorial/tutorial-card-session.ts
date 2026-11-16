"use client";

import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { trackAnalyticsEvent } from "@/lib/analytics-events";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";

export type TutorialCardLayer = "draw-cards" | "custom-card" | "card-groups";
export type TutorialCardAddMethod = "random" | "custom" | "group";

export interface TutorialLayerOrigin {
  x: number;
  y: number;
}

export const TUTORIAL_CARD_LAYER_OPENED_EVENT = "foxiesdeck:tutorial-card-layer-opened";
export const TUTORIAL_CARD_LAYER_CLOSED_EVENT = "foxiesdeck:tutorial-card-layer-closed";
export const TUTORIAL_CARD_LAYER_REQUESTED_EVENT = "foxiesdeck:tutorial-card-layer-requested";
export const TUTORIAL_CARD_LAYER_ADD_ATTEMPTED_EVENT = "foxiesdeck:tutorial-card-layer-add-attempted";
export const TUTORIAL_CARD_LAYER_PROMPT_CHANGED_EVENT = "foxiesdeck:tutorial-card-layer-prompt-changed";

export interface TutorialCardLayerRequestedDetail {
  layer: TutorialCardLayer;
}

export interface TutorialCardLayerOpenedDetail {
  layer: TutorialCardLayer;
  origin: TutorialLayerOrigin;
}

export interface TutorialCardLayerClosedDetail {
  layer: TutorialCardLayer;
}

export interface TutorialCardLayerAddAttemptedDetail {
  layer: TutorialCardLayer;
  count: number;
}

export interface TutorialCardLayerPromptChangedDetail {
  layer: TutorialCardLayer;
  active: boolean;
}

export function getTutorialCardAddMethod(layer: TutorialCardLayer): TutorialCardAddMethod {
  if (layer === "draw-cards") return "random";
  if (layer === "custom-card") return "custom";
  return "group";
}

export function dispatchTutorialCardLayerOpened(detail: TutorialCardLayerOpenedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TutorialCardLayerOpenedDetail>(TUTORIAL_CARD_LAYER_OPENED_EVENT, { detail }));
}

export function dispatchTutorialCardLayerRequested(detail: TutorialCardLayerRequestedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TutorialCardLayerRequestedDetail>(TUTORIAL_CARD_LAYER_REQUESTED_EVENT, { detail }));
}

export function dispatchTutorialCardLayerClosed(detail: TutorialCardLayerClosedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TutorialCardLayerClosedDetail>(TUTORIAL_CARD_LAYER_CLOSED_EVENT, { detail }));
}

export function dispatchTutorialCardLayerAddAttempted(detail: TutorialCardLayerAddAttemptedDetail) {
  if (typeof window === "undefined" || !Number.isInteger(detail.count) || detail.count <= 0) return;

  const tutorialState = useTutorialStore.getState();
  if (tutorialState.active && !tutorialState.completed && !tutorialState.testMode) {
    const analyticsProperties = {
      method: getTutorialCardAddMethod(detail.layer),
      added_count: detail.count,
    };
    trackAnalyticsEvent("tutorial_cards_added", analyticsProperties);
    sendTwaAnalyticsEvent("fd_tutorial_cards_added", { params: analyticsProperties });
  }

  window.dispatchEvent(new CustomEvent<TutorialCardLayerAddAttemptedDetail>(TUTORIAL_CARD_LAYER_ADD_ATTEMPTED_EVENT, { detail }));
}

export function dispatchTutorialCardLayerPromptChanged(detail: TutorialCardLayerPromptChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TutorialCardLayerPromptChangedDetail>(TUTORIAL_CARD_LAYER_PROMPT_CHANGED_EVENT, { detail }));
}

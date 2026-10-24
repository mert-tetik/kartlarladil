export type TutorialCardLayer = "draw-cards" | "custom-card" | "card-groups";

export interface TutorialLayerOrigin {
  x: number;
  y: number;
}

export const TUTORIAL_CARD_LAYER_OPENED_EVENT = "foxiesdeck:tutorial-card-layer-opened";
export const TUTORIAL_CARD_LAYER_CLOSED_EVENT = "foxiesdeck:tutorial-card-layer-closed";
export const TUTORIAL_CARD_LAYER_REQUESTED_EVENT = "foxiesdeck:tutorial-card-layer-requested";
export const TUTORIAL_CARD_LAYER_CARDS_ADDED_EVENT = "foxiesdeck:tutorial-card-layer-cards-added";
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

export interface TutorialCardLayerCardsAddedDetail {
  layer: TutorialCardLayer;
  count: number;
}

export interface TutorialCardLayerPromptChangedDetail {
  layer: TutorialCardLayer;
  active: boolean;
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

export function dispatchTutorialCardLayerCardsAdded(detail: TutorialCardLayerCardsAddedDetail) {
  if (typeof window === "undefined" || !Number.isInteger(detail.count) || detail.count <= 0) return;
  window.dispatchEvent(new CustomEvent<TutorialCardLayerCardsAddedDetail>(TUTORIAL_CARD_LAYER_CARDS_ADDED_EVENT, { detail }));
}

export function dispatchTutorialCardLayerPromptChanged(detail: TutorialCardLayerPromptChangedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TutorialCardLayerPromptChangedDetail>(TUTORIAL_CARD_LAYER_PROMPT_CHANGED_EVENT, { detail }));
}

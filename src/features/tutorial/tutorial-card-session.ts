export type TutorialCardLayer = "draw-cards" | "custom-card" | "card-groups";

export interface TutorialLayerOrigin {
  x: number;
  y: number;
}

export const TUTORIAL_CARD_LAYER_OPENED_EVENT = "foxiesdeck:tutorial-card-layer-opened";
export const TUTORIAL_CARD_LAYER_CLOSED_EVENT = "foxiesdeck:tutorial-card-layer-closed";

export interface TutorialCardLayerOpenedDetail {
  layer: TutorialCardLayer;
  origin: TutorialLayerOrigin;
}

export interface TutorialCardLayerClosedDetail {
  layer: TutorialCardLayer;
}

export function dispatchTutorialCardLayerOpened(detail: TutorialCardLayerOpenedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TutorialCardLayerOpenedDetail>(TUTORIAL_CARD_LAYER_OPENED_EVENT, { detail }));
}

export function dispatchTutorialCardLayerClosed(detail: TutorialCardLayerClosedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TutorialCardLayerClosedDetail>(TUTORIAL_CARD_LAYER_CLOSED_EVENT, { detail }));
}

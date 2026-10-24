import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  dispatchTutorialCardLayerAddAttempted,
  dispatchTutorialCardLayerClosed,
  dispatchTutorialCardLayerOpened,
} from "@/features/tutorial/tutorial-card-session";
import { useTutorialCardCloseGuidance } from "@/features/tutorial/use-tutorial-card-close-guidance";
import type { TutorialCardLayer } from "@/features/tutorial/tutorial-card-session";

function GuidanceProbe({ layer }: { layer: TutorialCardLayer }) {
  const showPointer = useTutorialCardCloseGuidance(layer);
  return <output data-testid="guidance-state">{showPointer ? "visible" : "hidden"}</output>;
}

describe("useTutorialCardCloseGuidance", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the close pointer as soon as three card additions are attempted in its tutorial layer", () => {
    render(<GuidanceProbe layer="draw-cards" />);

    act(() => dispatchTutorialCardLayerOpened({ layer: "draw-cards", origin: { x: 10, y: 20 } }));
    act(() => dispatchTutorialCardLayerAddAttempted({ layer: "draw-cards", count: 2 }));
    expect(screen.getByTestId("guidance-state")).toHaveTextContent("hidden");

    act(() => dispatchTutorialCardLayerAddAttempted({ layer: "custom-card", count: 10 }));
    expect(screen.getByTestId("guidance-state")).toHaveTextContent("hidden");

    act(() => dispatchTutorialCardLayerAddAttempted({ layer: "draw-cards", count: 1 }));
    expect(screen.getByTestId("guidance-state")).toHaveTextContent("visible");

    act(() => dispatchTutorialCardLayerClosed({ layer: "draw-cards" }));
    expect(screen.getByTestId("guidance-state")).toHaveTextContent("hidden");
  });

  it("resets the count when the same tutorial layer is opened again", () => {
    render(<GuidanceProbe layer="card-groups" />);

    act(() => dispatchTutorialCardLayerOpened({ layer: "card-groups", origin: { x: 10, y: 20 } }));
    act(() => dispatchTutorialCardLayerAddAttempted({ layer: "card-groups", count: 3 }));
    expect(screen.getByTestId("guidance-state")).toHaveTextContent("visible");

    act(() => dispatchTutorialCardLayerClosed({ layer: "card-groups" }));
    act(() => dispatchTutorialCardLayerOpened({ layer: "card-groups", origin: { x: 10, y: 20 } }));
    expect(screen.getByTestId("guidance-state")).toHaveTextContent("hidden");
  });
});

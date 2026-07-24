import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileEmptyDeckPointer } from "@/app/components/mobile-empty-deck-pointer";

function setRect(element: HTMLElement, rect: Partial<DOMRect>) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    bottom: 50,
    height: 40,
    left: 120,
    right: 160,
    top: 10,
    width: 40,
    x: 120,
    y: 10,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

function useMobileViewport() {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
}

describe("MobileEmptyDeckPointer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("marks the draw action without capturing its pointer events", async () => {
    useMobileViewport();
    const drawButton = document.createElement("button");
    drawButton.dataset.tutorialTarget = "landing-draw-cards";
    const onDraw = vi.fn();
    drawButton.addEventListener("click", onDraw);
    setRect(drawButton, {});
    document.body.append(drawButton);

    render(<MobileEmptyDeckPointer enabled />);

    const pointer = await screen.findByTestId("mobile-empty-deck-pointer");
    expect(pointer).toHaveClass("tutorial-pointer", "pointer-events-none");
    expect(pointer).toHaveStyle({ top: "45px" });
    fireEvent.click(drawButton);
    expect(onDraw).toHaveBeenCalledOnce();
  });

  it("hides while the landing tutorial is open", async () => {
    useMobileViewport();
    const drawButton = document.createElement("button");
    drawButton.dataset.tutorialTarget = "landing-draw-cards";
    setRect(drawButton, {});
    document.body.append(drawButton);

    const dialog = document.createElement("div");
    dialog.dataset.landingTutorial = "";
    setRect(dialog, { height: 200, width: 200 });
    document.body.append(dialog);

    render(<MobileEmptyDeckPointer enabled />);

    await waitFor(() => {
      expect(screen.queryByTestId("mobile-empty-deck-pointer")).not.toBeInTheDocument();
    });
  });

  it("hides while the subscription success popup is open", async () => {
    useMobileViewport();
    const drawButton = document.createElement("button");
    drawButton.dataset.tutorialTarget = "landing-draw-cards";
    setRect(drawButton, {});
    document.body.append(drawButton);

    const dialog = document.createElement("div");
    dialog.dataset.subscriptionPurchaseSuccessDialog = "";
    setRect(dialog, { height: 200, width: 200 });
    document.body.append(dialog);

    render(<MobileEmptyDeckPointer enabled />);

    await waitFor(() => {
      expect(screen.queryByTestId("mobile-empty-deck-pointer")).not.toBeInTheDocument();
    });
  });
});

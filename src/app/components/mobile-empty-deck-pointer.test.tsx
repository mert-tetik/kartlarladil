import { render, screen, waitFor } from "@testing-library/react";
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

describe("MobileEmptyDeckPointer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("marks the draw action without capturing its pointer events", async () => {
    render(<MobileEmptyDeckPointer enabled />);

    const pointer = await screen.findByTestId("mobile-empty-deck-pointer");
    expect(pointer).toHaveClass("pointer-events-none", "absolute");
    expect(pointer).toHaveClass("empty-deck-pointer-anchor");
    expect(pointer.querySelector("img")).toHaveClass("empty-deck-pointer-image");
    expect(pointer.querySelector("img")).toHaveAttribute("src", expect.stringContaining("pointer-icon.png"));
  });

  it("hides while the landing tutorial is open", async () => {
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
    const dialog = document.createElement("div");
    dialog.dataset.subscriptionPurchaseSuccessDialog = "";
    setRect(dialog, { height: 200, width: 200 });
    document.body.append(dialog);

    render(<MobileEmptyDeckPointer enabled />);

    await waitFor(() => {
      expect(screen.queryByTestId("mobile-empty-deck-pointer")).not.toBeInTheDocument();
    });
  });

  it("hides while any visible modal dialog is open", async () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    setRect(dialog, { height: 200, width: 200 });
    document.body.append(dialog);

    render(<MobileEmptyDeckPointer enabled />);

    await waitFor(() => {
      expect(screen.queryByTestId("mobile-empty-deck-pointer")).not.toBeInTheDocument();
    });
  });
});

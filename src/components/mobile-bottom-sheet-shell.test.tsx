import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";

function renderShell(onClose = vi.fn()) {
  render(
    <LocaleProvider initialLocale="en">
      <MobileBottomSheetShell
        open
        onClose={onClose}
        title="Shared menu"
        visual={<span data-testid="shared-visual" />}
      >
        <p>Menu content</p>
      </MobileBottomSheetShell>
    </LocaleProvider>,
  );

  return onClose;
}

describe("MobileBottomSheetShell", () => {
  it("renders the shared shell, title, visual, and menu content", async () => {
    renderShell();

    await waitFor(() => expect(screen.getByRole("dialog", { name: "Shared menu" })).toHaveAttribute("data-mobile-bottom-sheet"));
    expect(screen.getByRole("heading", { name: "Shared menu" })).toHaveClass("text-3xl");
    expect(screen.getByTestId("shared-visual")).toBeInTheDocument();
    expect(screen.getByText("Menu content")).toBeInTheDocument();
    expect(screen.getByTestId("shared-visual").closest("[data-mobile-bottom-sheet-visual]")).not.toBeNull();
  });

  it("closes from the backdrop, close button, and Escape", async () => {
    const onClose = renderShell();
    const dialog = await screen.findByRole("dialog", { name: "Shared menu" });
    const backdrop = dialog.querySelector<HTMLButtonElement>(":scope > button");

    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[1]);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("closes when the drag handle is pulled down past the threshold", async () => {
    const onClose = renderShell();
    const visual = await screen.findByTestId("shared-visual");
    const handle = visual.closest("[data-mobile-bottom-sheet-drag-handle]");

    expect(handle).not.toBeNull();
    Object.defineProperty(handle, "setPointerCapture", { value: vi.fn() });
    fireEvent.pointerDown(handle!, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle!, { clientY: 240, pointerId: 1 });
    fireEvent.pointerUp(handle!, { clientY: 240, pointerId: 1 });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

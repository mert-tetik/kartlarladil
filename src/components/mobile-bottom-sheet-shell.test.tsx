import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";

function renderShell(onClose = vi.fn(), tone: "brand" | "lime" | "purple" | "mission" = "brand") {
  render(
    <LocaleProvider initialLocale="en">
      <MobileBottomSheetShell
        open
        onClose={onClose}
        title="Shared menu"
        visual={<span data-testid="shared-visual" />}
        tone={tone}
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

  it("supports a lime tone for menus that need a dedicated color", async () => {
    renderShell(vi.fn(), "lime");

    const dialog = await screen.findByRole("dialog", { name: "Shared menu" });
    const panel = dialog.querySelector("[data-mobile-bottom-sheet-panel]");

    expect(panel).toHaveClass("bg-lime-400", "text-lime-950");
    expect(screen.getByRole("heading", { name: "Shared menu" })).toHaveClass("text-lime-950");
  });

  it("supports a purple tone with the standard light-purple decoration", async () => {
    renderShell(vi.fn(), "purple");

    const dialog = await screen.findByRole("dialog", { name: "Shared menu" });
    const panel = dialog.querySelector("[data-mobile-bottom-sheet-panel]");
    const decoration = panel?.querySelector("div[aria-hidden='true']");
    const circle = panel?.querySelector("[data-mobile-bottom-sheet-protrusion] > span[aria-hidden='true']");

    expect(panel).toHaveClass("bg-purple-600", "text-white");
    expect(screen.getByRole("heading", { name: "Shared menu" })).toHaveClass("text-white");
    expect(decoration?.getAttribute("style")).toContain("rgb(147, 51, 234)");
    expect(decoration?.getAttribute("style")).not.toContain("82% 82%");
    expect(decoration).toHaveStyle({ opacity: "1" });
    expect(circle?.getAttribute("style")).toContain("background-color: white");
  });

  it("supports the mission gold tone", async () => {
    renderShell(vi.fn(), "mission");

    const dialog = await screen.findByRole("dialog", { name: "Shared menu" });
    const panel = dialog.querySelector("[data-mobile-bottom-sheet-panel]");
    const protrusion = panel?.querySelector("[data-mobile-bottom-sheet-protrusion] > span:first-child");
    const circle = panel?.querySelector("[data-mobile-bottom-sheet-protrusion] > span[aria-hidden='true']");
    const closeButton = panel?.querySelector("button[aria-label='Close']");

    expect(panel).toHaveClass("bg-[#ffb833]", "text-[#2E240F]");
    expect(screen.getByRole("heading", { name: "Shared menu" })).toHaveClass("text-white");
    expect(closeButton).toHaveClass("text-white/90");
    expect(protrusion?.getAttribute("style")).toContain("background-color: rgb(255, 184, 51)");
    expect(circle?.getAttribute("style")).toContain("color-mix(in srgb, rgb(255, 184, 51) 62%, white)");
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

  it("notifies after the sheet finishes its exit animation", async () => {
    const onClose = vi.fn();
    const onExited = vi.fn();
    const { rerender } = render(
      <LocaleProvider initialLocale="en">
        <MobileBottomSheetShell
          open
          onClose={onClose}
          onExited={onExited}
          title="Shared menu"
          visual={<span data-testid="shared-visual" />}
        >
          <p>Menu content</p>
        </MobileBottomSheetShell>
      </LocaleProvider>,
    );

    await screen.findByRole("dialog", { name: "Shared menu" });
    rerender(
      <LocaleProvider initialLocale="en">
        <MobileBottomSheetShell
          open={false}
          onClose={onClose}
          onExited={onExited}
          title="Shared menu"
          visual={<span data-testid="shared-visual" />}
        >
          <p>Menu content</p>
        </MobileBottomSheetShell>
      </LocaleProvider>,
    );

    await waitFor(() => expect(onExited).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(screen.queryByRole("dialog", { name: "Shared menu" })).not.toBeInTheDocument();
  });
});

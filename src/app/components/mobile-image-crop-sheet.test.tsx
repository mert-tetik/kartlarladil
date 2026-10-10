import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileImageCropSheet } from "@/app/components/mobile-image-crop-sheet";
import { LocaleProvider } from "@/i18n/locale-provider";

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

describe("MobileImageCropSheet", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  it("enables the confirm action only after the selected image has decoded", async () => {
    renderCropSheet();

    const image = screen.getByAltText("Fotoğrafı kırp");
    const confirmButton = screen.getByRole("button", { name: "Kırpılmış fotoğrafı kullan" });
    expect(confirmButton).toBeDisabled();

    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 1200 },
      naturalHeight: { configurable: true, value: 800 },
    });
    fireEvent.load(image);

    await waitFor(() => expect(confirmButton).toBeEnabled());
  });

  it("keeps the confirm action locked and reports a decode failure", () => {
    renderCropSheet();

    const image = screen.getByAltText("Fotoğrafı kırp");
    const confirmButton = screen.getByRole("button", { name: "Kırpılmış fotoğrafı kullan" });
    fireEvent.error(image);

    expect(screen.getByRole("alert")).toHaveAttribute("data-image-crop-error");
    expect(confirmButton).toBeDisabled();
  });
});

function renderCropSheet() {
  return render(
    <LocaleProvider initialLocale="tr">
      <MobileImageCropSheet
        open
        imageUrl="data:image/png;base64,iVBORw0KGgo="
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    </LocaleProvider>,
  );
}

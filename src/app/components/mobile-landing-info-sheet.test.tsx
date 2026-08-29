import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MobileLandingInfoSheet } from "@/app/components/mobile-landing-info-sheet";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("MobileLandingInfoSheet", () => {
  it("renders steps on transparent surfaces with theme foreground text", async () => {
    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingInfoSheet isOpen onClose={vi.fn()} />
      </LocaleProvider>,
    );

    const firstStepText = await screen.findByText("Destene yeni kelimeler ekle ve koleksiyonunu oluştur.");
    expect(firstStepText).toHaveClass("text-white");
    expect(firstStepText.parentElement).toHaveClass("bg-action-learn");
    expect(screen.getByRole("dialog")).toHaveAttribute("data-mobile-bottom-sheet");
  });
});

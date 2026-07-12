import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { MobileLandingInfoSheet } from "@/app/components/mobile-landing-info-sheet";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("MobileLandingInfoSheet", () => {
  it("renders steps on transparent surfaces with theme foreground text", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <MobileLandingInfoSheet isOpen onClose={vi.fn()} />
      </LocaleProvider>,
    );

    const firstStepText = screen.getByText("Kart çek butonuyla yeni kelimeler keşfet.");
    expect(firstStepText).toHaveClass("text-foreground");
    expect(firstStepText.parentElement).toHaveClass("border-transparent", "bg-transparent");
  });
});

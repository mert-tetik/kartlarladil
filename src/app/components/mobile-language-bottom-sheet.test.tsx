import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/locale-provider";
import { MobileLanguageBottomSheet } from "@/app/components/mobile-language-bottom-sheet";

vi.mock("@/lib/vibration", () => ({
  vibrate: vi.fn(),
}));

describe("MobileLanguageBottomSheet", () => {
  it("uses the navbar language option treatment for the mobile shared menus", async () => {
    render(
      <LocaleProvider initialLocale="en">
        <MobileLanguageBottomSheet
          isOpen
          onClose={vi.fn()}
          options={[{ code: "en", count: 1 }, { code: "tr", count: 0 }]}
          selectedLanguage="en"
          onSelect={vi.fn()}
          optionStyle="navbar"
          showCounts={false}
        />
      </LocaleProvider>,
    );

    const selected = await screen.findByRole("button", { name: /English/i });
    expect(selected).toHaveClass("min-h-36");
    expect(selected).toHaveClass("text-center");
    expect(selected.querySelector("[data-testid='language-flag-outline']")).toBeNull();
    expect(selected.querySelector("svg")).toBeNull();
    expect(selected).toHaveTextContent("English");

    const selectedText = selected.querySelector("span.min-h-8");
    expect(selectedText).toHaveClass("text-base");
    expect(selectedText).toHaveClass("text-brand-foreground");
    expect(selected.querySelector("[style*='filter']")).not.toBeNull();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { FilterControls } from "@/features/cards/components/filter-controls";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("FilterControls", () => {
  it("renders language selection as a dropdown", () => {
    const onLanguageChange = vi.fn();
    const onTierChange = vi.fn();

    render(
      <LocaleProvider initialLocale="tr">
        <FilterControls
          language="en"
          tier="A1"
          onLanguageChange={onLanguageChange}
          onTierChange={onTierChange}
        />
      </LocaleProvider>,
    );

    const languageDropdownButton = screen.getByRole("button", { name: /İngilizce/ });

    expect(languageDropdownButton).toHaveAttribute("aria-haspopup", "listbox");

    fireEvent.click(languageDropdownButton);
    fireEvent.click(screen.getByRole("option", { name: /Almanca/ }));

    expect(onLanguageChange).toHaveBeenCalledWith("de");
  });
});

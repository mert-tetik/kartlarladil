import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterControls } from "@/features/cards/components/filter-controls";

describe("FilterControls", () => {
  it("renders language as a mobile dropdown while keeping the desktop segmented control", () => {
    const onLanguageChange = vi.fn();
    const onTierChange = vi.fn();

    render(
      <FilterControls
        language="en"
        tier="A1"
        onLanguageChange={onLanguageChange}
        onTierChange={onTierChange}
      />,
    );

    const languageButtons = screen.getAllByRole("button", { name: /İngilizce/ });
    const mobileDropdownButton = languageButtons.find(
      (button) => button.getAttribute("aria-haspopup") === "listbox",
    );
    const desktopSegmentButton = languageButtons.find(
      (button) => button.getAttribute("aria-pressed") === "true",
    );

    expect(mobileDropdownButton).toBeDefined();
    expect(desktopSegmentButton).toBeDefined();

    fireEvent.click(mobileDropdownButton!);
    fireEvent.click(screen.getByRole("option", { name: /Almanca/ }));

    expect(onLanguageChange).toHaveBeenCalledWith("de");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import {
  MobileCustomCardLanguagePicker,
  usesNonLatinWritingSystem,
} from "@/app/components/mobile-custom-card-language-picker";
import { LocaleProvider } from "@/i18n/locale-provider";

describe("MobileCustomCardLanguagePicker", () => {
  it("shows the selected language and lets the user choose a different target", () => {
    const onChange = vi.fn();

    render(
      <LocaleProvider initialLocale="en">
        <MobileCustomCardLanguagePicker value="ru" onChange={onChange} />
      </LocaleProvider>,
    );

    expect(screen.getByRole("button", { name: /russian/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /russian/i }));
    fireEvent.click(screen.getByRole("option", { name: /german/i }));

    expect(onChange).toHaveBeenCalledWith("de");
  });

  it("only shows the transliteration guidance for non-Latin target languages", () => {
    expect(usesNonLatinWritingSystem("ru")).toBe(true);
    expect(usesNonLatinWritingSystem("ar")).toBe(true);
    expect(usesNonLatinWritingSystem("en")).toBe(false);
    expect(usesNonLatinWritingSystem("tr")).toBe(false);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import {
  MobileCustomCardLanguagePicker,
  usesNonLatinWritingSystem,
} from "@/app/components/mobile-custom-card-language-picker";
import { LocaleProvider } from "@/i18n/locale-provider";

describe("MobileCustomCardLanguagePicker", () => {
  it("shows the landing language for Auto and lets the user choose a different target", () => {
    const onChange = vi.fn();

    render(
      <LocaleProvider initialLocale="en">
        <MobileCustomCardLanguagePicker value="auto" resolvedLanguage="ru" onChange={onChange} />
      </LocaleProvider>,
    );

    expect(screen.getByRole("button", { name: /auto.*russian/i })).toBeInTheDocument();
    expect(screen.getByText(/latin letters/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /auto.*russian/i }));
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

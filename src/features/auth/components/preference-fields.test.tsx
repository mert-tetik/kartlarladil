import type { ComponentProps } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PreferenceFields } from "@/features/auth/components/preference-fields";
import { LocaleProvider } from "@/i18n/locale-provider";

describe("PreferenceFields", () => {
  it("renders the All tier option", () => {
    renderPreferenceFields();

    expect(screen.getByRole("radio", { name: /Tümü/i })).toBeInTheDocument();
  });

  it("renders the All tier option first", () => {
    renderPreferenceFields();

    expect(screen.getAllByRole("radio")[0]).toHaveAttribute("value", "all");
  });

  it("keeps A1 selected by default", () => {
    renderPreferenceFields();

    expect(screen.getByRole("radio", { name: /A1/i })).toBeChecked();
  });

  it("selects All when the default preferred tier is all", () => {
    renderPreferenceFields({ defaultTier: "all" });

    expect(screen.getByRole("radio", { name: /Tümü/i })).toBeChecked();
  });

  it("swaps practice language when it would match the new site language", () => {
    renderPreferenceFields({ defaultLanguage: "en", defaultUiLocale: "tr" });

    expect(getHiddenInput("preferredLanguageCode")).toHaveValue("en");
    expect(getHiddenInput("preferredUiLocale")).toHaveValue("tr");

    // Change site language to English (same as practice language).
    fireEvent.click(getPickerButton("preferredUiLocale"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /English/i }));

    expect(getHiddenInput("preferredLanguageCode")).toHaveValue("tr");
    expect(getHiddenInput("preferredUiLocale")).toHaveValue("en");
  });

  it("swaps site language when it would match the new practice language", () => {
    renderPreferenceFields({ defaultLanguage: "en", defaultUiLocale: "tr" });

    // Change practice language to Turkish (same as site language).
    fireEvent.click(getPickerButton("preferredLanguageCode"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Türkçe/i }));

    expect(getHiddenInput("preferredLanguageCode")).toHaveValue("tr");
    expect(getHiddenInput("preferredUiLocale")).toHaveValue("en");
  });
});

function renderPreferenceFields(props?: Partial<ComponentProps<typeof PreferenceFields>>) {
  return render(
    <LocaleProvider initialLocale="tr">
      <PreferenceFields {...props} />
    </LocaleProvider>,
  );
}

function getHiddenInput(name: string) {
  return document.querySelector(`input[type="hidden"][name="${name}"]`) as HTMLInputElement;
}

function getPickerButton(name: string) {
  return document.querySelector(`[data-language-picker="${name}"] button`) as HTMLButtonElement;
}

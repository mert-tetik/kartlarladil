import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { PreferenceFields } from "@/features/auth/components/preference-fields";
import { LocaleProvider } from "@/i18n/locale-provider";

describe("PreferenceFields", () => {
  it("renders the All tier option", () => {
    renderPreferenceFields();

    expect(screen.getByRole("radio", { name: /Tümü/i })).toBeInTheDocument();
  });

  it("keeps A1 selected by default", () => {
    renderPreferenceFields();

    expect(screen.getByRole("radio", { name: /A1/i })).toBeChecked();
  });

  it("selects All when the default preferred tier is all", () => {
    renderPreferenceFields({ defaultTier: "all" });

    expect(screen.getByRole("radio", { name: /Tümü/i })).toBeChecked();
  });
});

function renderPreferenceFields(props?: Partial<ComponentProps<typeof PreferenceFields>>) {
  return render(
    <LocaleProvider initialLocale="tr">
      <PreferenceFields {...props} />
    </LocaleProvider>,
  );
}

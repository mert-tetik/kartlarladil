import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/i18n/locale-provider";
import { SuperWaterText } from "@/components/super-water-text";

describe("SuperWaterText", () => {
  it("uses the Super Water font and glyph-safe text for supported locales", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <SuperWaterText>Kart Oluştur</SuperWaterText>
      </LocaleProvider>,
    );

    expect(screen.getByText("Kart Olustur")).toHaveClass("font-super-water");
  });

  it("keeps unsupported scripts intact and uses the normal font", () => {
    render(
      <LocaleProvider initialLocale="ru">
        <SuperWaterText>Идет обработка</SuperWaterText>
      </LocaleProvider>,
    );

    expect(screen.getByText("Идет обработка")).not.toHaveClass("font-super-water");
  });
});

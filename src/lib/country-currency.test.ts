import {
  getCountryCodeFromLocale,
  getCurrencyCodeForCountry,
} from "@/lib/country-currency";

describe("country currency helpers", () => {
  it("maps Turkey to TRY", () => {
    expect(getCurrencyCodeForCountry("TR")).toBe("TRY");
  });

  it("maps other primary markets to their local currencies", () => {
    expect(getCurrencyCodeForCountry("RU")).toBe("RUB");
    expect(getCurrencyCodeForCountry("SA")).toBe("SAR");
    expect(getCurrencyCodeForCountry("AE")).toBe("AED");
  });

  it("maps eurozone countries to EUR", () => {
    expect(getCurrencyCodeForCountry("DE")).toBe("EUR");
    expect(getCurrencyCodeForCountry("fr")).toBe("EUR");
  });

  it("derives a country from a browser locale", () => {
    expect(getCountryCodeFromLocale("tr-TR")).toBe("TR");
    expect(getCountryCodeFromLocale("en-US")).toBe("US");
  });

  it("returns null for unsupported or invalid values", () => {
    expect(getCurrencyCodeForCountry("XX")).toBeNull();
    expect(getCountryCodeFromLocale("not_a_locale")).toBeNull();
  });
});

const EURO_COUNTRIES = new Set([
  "AD",
  "AT",
  "BE",
  "CY",
  "DE",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MC",
  "ME",
  "MT",
  "NL",
  "PT",
  "SI",
  "SK",
  "SM",
  "VA",
]);

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  AE: "AED",
  AR: "ARS",
  AU: "AUD",
  BA: "BAM",
  BH: "BHD",
  BO: "BOB",
  BG: "BGN",
  BR: "BRL",
  BY: "BYN",
  CA: "CAD",
  CH: "CHF",
  CL: "CLP",
  CN: "CNY",
  CO: "COP",
  CR: "CRC",
  CZ: "CZK",
  DK: "DKK",
  DO: "DOP",
  DZ: "DZD",
  EC: "USD",
  EG: "EGP",
  GB: "GBP",
  GE: "GEL",
  GT: "GTQ",
  HK: "HKD",
  HN: "HNL",
  HU: "HUF",
  ID: "IDR",
  IL: "ILS",
  IN: "INR",
  IQ: "IQD",
  IS: "ISK",
  JO: "JOD",
  JP: "JPY",
  KE: "KES",
  KW: "KWD",
  KZ: "KZT",
  KR: "KRW",
  LB: "LBP",
  MA: "MAD",
  MX: "MXN",
  MY: "MYR",
  NG: "NGN",
  NI: "NIO",
  NO: "NOK",
  NZ: "NZD",
  OM: "OMR",
  PA: "PAB",
  PE: "PEN",
  PH: "PHP",
  PL: "PLN",
  PY: "PYG",
  QA: "QAR",
  RO: "RON",
  RS: "RSD",
  RU: "RUB",
  SA: "SAR",
  SE: "SEK",
  SV: "USD",
  SG: "SGD",
  TH: "THB",
  TN: "TND",
  TR: "TRY",
  UA: "UAH",
  UY: "UYU",
  US: "USD",
  VE: "VES",
  VN: "VND",
  ZA: "ZAR",
};

export function getCurrencyCodeForCountry(
  countryCode: string | null | undefined,
): string | null {
  const normalized = countryCode?.trim().toUpperCase();
  if (!normalized) return null;
  if (EURO_COUNTRIES.has(normalized)) return "EUR";
  return CURRENCY_BY_COUNTRY[normalized] ?? null;
}

export function getCountryCodeFromLocale(
  locale: string | null | undefined,
): string | null {
  if (!locale) return null;

  try {
    return new Intl.Locale(locale).region ?? null;
  } catch {
    return null;
  }
}

import type { LocaleCode } from "@/types/domain";

const TURKISH_ASCII_CHARACTERS: Record<string, string> = {
  Ç: "C",
  ç: "c",
  Ğ: "G",
  ğ: "g",
  İ: "I",
  ı: "i",
  Ö: "O",
  ö: "o",
  Ş: "S",
  ş: "s",
  Ü: "U",
  ü: "u",
};

// Super Water only contains the English alphabet. Turkish copy is rendered with ASCII equivalents.
export function canUseSuperWater(locale: LocaleCode) {
  return locale === "en" || locale === "tr";
}

export function formatSuperWaterText(locale: LocaleCode, text: string) {
  if (locale !== "tr") {
    return text;
  }

  return text.replace(/[ÇçĞğİıÖöŞşÜü]/g, (character) => TURKISH_ASCII_CHARACTERS[character] ?? character);
}

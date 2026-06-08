import type { Language, LanguageCode } from "@/types/domain";

export const LANGUAGES: Language[] = [
  {
    code: "en",
    name: "İngilizce",
    nativeName: "English",
    accent: "#2563eb",
  },
  {
    code: "de",
    name: "Almanca",
    nativeName: "Deutsch",
    accent: "#0f766e",
  },
  {
    code: "ru",
    name: "Rusça",
    nativeName: "Russkiy",
    accent: "#b42318",
  },
];

export const LANGUAGE_NAMES: Record<LanguageCode, string> = LANGUAGES.reduce(
  (acc, language) => ({ ...acc, [language.code]: language.name }),
  {} as Record<LanguageCode, string>,
);

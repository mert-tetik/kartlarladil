import type { LanguageCode } from "@/types/domain";

export const NATIVE_WRITING_SYSTEMS: Partial<Record<LanguageCode, string>> = {
  ru: "Cyrillic",
  ar: "Arabic",
  ja: "Japanese",
  ko: "Korean",
  "zh-CN": "Simplified Chinese",
};

const TARGET_SCRIPT_PATTERNS: Partial<Record<LanguageCode, RegExp>> = {
  ru: /[\u0400-\u052f]/u,
  ar: /[\u0600-\u06ff]/u,
  ja: /[\u3040-\u30ff\u3400-\u9fff]/u,
  ko: /[\uac00-\ud7af]/u,
  "zh-CN": /[\u3400-\u9fff]/u,
};

const LATIN_TRANSLITERATION_REPLACEMENTS: readonly [RegExp, string][] = [
  [/w/gu, "v"],
  [/\u00e6/gu, "ae"],
  [/\u0153/gu, "oe"],
  [/\u00df/gu, "ss"],
  [/[\u015f\u0219\u0161]/gu, "sh"],
  [/[\u00e7\u010d\u0107]/gu, "ch"],
  [/\u011f/gu, "g"],
  [/\u0131/gu, "i"],
  [/[\u00f6\u0151\u00f8]/gu, "o"],
  [/[\u00fc\u0171]/gu, "u"],
  [/[\u00e4\u00e3\u00e5\u00e1\u00e0\u00e2\u0101]/gu, "a"],
  [/[\u00eb\u00e9\u00e8\u00ea\u0113]/gu, "e"],
  [/[\u00ef\u00ed\u00ec\u00ee\u012b]/gu, "i"],
  [/[\u00f5\u00f3\u00f2\u00f4\u014d]/gu, "o"],
  [/[\u00fa\u00f9\u00fb\u016b]/gu, "u"],
  [/\u00f1/gu, "n"],
  [/[\u00fd\u00ff]/gu, "y"],
  [/\u0142/gu, "l"],
  [/[\u00f0\u0111]/gu, "d"],
  [/\u00fe/gu, "th"],
  [/\u0127/gu, "h"],
  [/\u014b/gu, "n"],
  [/\u0167/gu, "t"],
  [/\u0192/gu, "f"],
];

export function normalizeLatinTransliteration(value: string) {
  let normalized = value.trim().normalize("NFC").toLocaleLowerCase("tr");

  for (const [pattern, replacement] of LATIN_TRANSLITERATION_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\u2019'`]/gu, "")
    .replace(/[\u2010-\u2015]/gu, " ")
    .replace(/[.,!?()[\]{}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizeTransliterationMatchKey(value: string) {
  return normalizeLatinTransliteration(value).replace(/[\s-]/gu, "");
}

export function requiresNativeWritingSystem(language: LanguageCode) {
  return Boolean(NATIVE_WRITING_SYSTEMS[language]);
}

export function containsRequiredTargetScript(term: string, language: LanguageCode) {
  const pattern = TARGET_SCRIPT_PATTERNS[language];
  return !pattern || pattern.test(term);
}

export function buildTransliterationHint(term: string, language?: LanguageCode) {
  if (!language || !requiresNativeWritingSystem(language)) {
    return "";
  }

  const normalized = normalizeLatinTransliteration(term);
  if (!normalized || normalized === term.trim().toLocaleLowerCase("tr")) {
    return "";
  }

  return `The same input normalized into a common Latin pronunciation spelling is "${normalized}". Treat the original and this normalized form as the same phonetic input.`;
}

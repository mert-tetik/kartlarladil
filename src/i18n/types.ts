import tr from "./locales/tr";

export type TranslationValues = Record<string, string | number>;
export type Dictionary = { [Key in keyof typeof tr]: string };
export type TranslationKey = keyof Dictionary;

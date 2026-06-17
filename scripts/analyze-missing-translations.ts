import { DICTIONARIES } from "../src/i18n/dictionaries";

const en = DICTIONARIES.en;
const locales = ["de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"] as const;

for (const loc of locales) {
  const dict = DICTIONARIES[loc];
  const missing = Object.keys(en).filter((k) => (dict as Record<string, string>)[k] === (en as Record<string, string>)[k]);
  console.log(`${loc}: ${missing.length} keys identical to English`);
  if (missing.length > 0) {
    console.log("  samples:", missing.slice(0, 8).join(", "));
  }
}

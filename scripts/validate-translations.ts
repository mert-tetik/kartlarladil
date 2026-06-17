import { DICTIONARIES } from "../src/i18n/dictionaries";

const en = DICTIONARIES.en;
const locales = ["de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"] as const;

function extractPlaceholders(value: string) {
  const matches = value.match(/\{\w+\}/g);
  return new Set(matches ?? []);
}

let totalIssues = 0;

for (const locale of locales) {
  const dict = DICTIONARIES[locale];
  let issues = 0;
  for (const key of Object.keys(en)) {
    const source = (en as Record<string, string>)[key];
    const translated = (dict as Record<string, string>)[key];
    const sourcePlaceholders = extractPlaceholders(source);
    const translatedPlaceholders = extractPlaceholders(translated);

    const missing = [...sourcePlaceholders].filter((p) => !translatedPlaceholders.has(p));
    const extra = [...translatedPlaceholders].filter((p) => !sourcePlaceholders.has(p));

    if (missing.length > 0 || extra.length > 0) {
      console.log(`[${locale}] ${key}`);
      if (missing.length > 0) console.log(`  missing: ${missing.join(", ")}`);
      if (extra.length > 0) console.log(`  extra: ${extra.join(", ")}`);
      issues++;
    }
  }
  if (issues === 0) {
    console.log(`[${locale}] all placeholders valid`);
  }
  totalIssues += issues;
}

if (totalIssues > 0) {
  console.log(`\nTotal placeholder issues: ${totalIssues}`);
  process.exit(1);
} else {
  console.log("\nAll placeholders valid across all locales.");
}

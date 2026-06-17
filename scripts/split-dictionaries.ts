import { writeFileSync, mkdirSync } from "node:fs";
import { DICTIONARIES } from "../src/i18n/dictionaries";

const locales = Object.keys(DICTIONARIES) as Array<keyof typeof DICTIONARIES>;

mkdirSync("src/i18n/locales", { recursive: true });

for (const locale of locales) {
  const dict = DICTIONARIES[locale];
  const entries = Object.entries(dict).sort(([a], [b]) => a.localeCompare(b));
  const lines = entries.map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n");
  const content = `import type { Dictionary } from "../types";

const dictionary = {
${lines}
} as const satisfies Dictionary;

export default dictionary;
`;
  writeFileSync(`src/i18n/locales/${locale}.ts`, content);
}

console.log(`Split ${locales.length} locale dictionaries into src/i18n/locales/`);

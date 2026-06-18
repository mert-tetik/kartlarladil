import { masterCardEntries } from "../src/data/card-seeds/master-list.ts";
import { LANGUAGE_CODES } from "../src/data/languages.ts";

const WORD_PATTERN = /^[\p{L}\p{M}\p{N}]+(?:[-'\s…][\p{L}\p{M}\p{N}]+){0,3}[-'\s…]?$/u;

const empty = [];
const slash = [];
const invalid = [];

for (const row of masterCardEntries) {
  for (let i = 0; i < LANGUAGE_CODES.length; i++) {
    const locale = LANGUAGE_CODES[i];
    const term = row[5 + i];
    const normalized = term.normalize("NFC");

    if (!normalized) {
      empty.push({ en: row[0], locale, pos: row[3] });
      continue;
    }

    if (normalized.includes("/") || normalized.includes("\\")) {
      slash.push({ en: row[0], locale, term });
      continue;
    }

    if (!WORD_PATTERN.test(normalized)) {
      invalid.push({ en: row[0], locale, term });
    }
  }
}

console.log("Boş çeviri:", empty.length);
console.log("Slash içeren:", slash.length);
console.log("Diğer geçersiz:", invalid.length);

console.log("\nSlash içeren örnekler:");
slash.slice(0, 50).forEach((b) => console.log(JSON.stringify(b)));

console.log("\nDiğer geçersiz örnekler:");
invalid.slice(0, 50).forEach((b) => console.log(JSON.stringify(b)));

console.log("\nBoş çeviri örnekler:");
empty.slice(0, 20).forEach((b) => console.log(JSON.stringify(b)));

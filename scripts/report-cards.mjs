import fs from "node:fs";
import { Module } from "node:module";
import path from "node:path";
import ts from "typescript";

const filename = path.resolve("src/data/cards.ts");
const source = fs.readFileSync(filename, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const catalogModule = new Module(filename);
catalogModule.filename = filename;
catalogModule.paths = Module._nodeModulePaths(process.cwd());
catalogModule._compile(output, filename);

const { CATALOG_REPORT } = catalogModule.exports;

console.log("Kartlarla Dil katalog raporu");
console.log("============================");
console.log(`Toplam kart: ${CATALOG_REPORT.total}`);
console.log("");
console.log("Dil dağılımı:");

for (const [language, count] of Object.entries(CATALOG_REPORT.byLanguage)) {
  console.log(`- ${language}: ${count}`);
}

console.log("");
console.log("Dil + tier dağılımı:");

for (const [language, tiers] of Object.entries(CATALOG_REPORT.byLanguageTier)) {
  const summary = Object.entries(tiers)
    .map(([tier, count]) => `${tier}: ${count}`)
    .join(", ");
  console.log(`- ${language}: ${summary}`);
}

console.log("");
console.log("Kelime türü dağılımı:");

for (const [partOfSpeech, count] of Object.entries(CATALOG_REPORT.byPartOfSpeech)) {
  console.log(`- ${partOfSpeech}: ${count}`);
}

console.log("");
console.log(`Geçersiz ana term: ${CATALOG_REPORT.invalidTerms.length}`);
console.log(`Duplicate language+term: ${CATALOG_REPORT.duplicateTerms.length}`);
console.log("");
console.log("Örnek kelimeler:");

for (const [language, samples] of Object.entries(CATALOG_REPORT.samples)) {
  console.log(`- ${language}: ${samples.join(", ")}`);
}

if (CATALOG_REPORT.invalidTerms.length > 0 || CATALOG_REPORT.duplicateTerms.length > 0) {
  process.exitCode = 1;
}

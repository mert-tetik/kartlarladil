import fs from "node:fs";
import { Module } from "node:module";
import path from "node:path";
import ts from "typescript";

const { CATALOG_REPORT } = loadTsModule("src/data/cards.ts");

console.log("FoxiesDeck katalog raporu");
console.log("============================");
console.log(`Toplam kart: ${CATALOG_REPORT.total}`);
console.log("");
console.log("Dil dağılımı:");

for (const [language, count] of Object.entries(CATALOG_REPORT.byLanguage)) {
  const strictWords = CATALOG_REPORT.strictWordCountByLanguage[language] ?? 0;
  const phrases = CATALOG_REPORT.fixedPhraseCountByLanguage[language] ?? 0;
  console.log(`- ${language}: ${count} kart (${strictWords} tek kelime, ${phrases} sabit ifade)`);
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
console.log(`Eksik locale çevirisi: ${CATALOG_REPORT.missingTranslations.length}`);
console.log("");
console.log("Örnek kelimeler:");

for (const [language, samples] of Object.entries(CATALOG_REPORT.samples)) {
  console.log(`- ${language}: ${samples.join(", ")}`);
}

if (
  CATALOG_REPORT.invalidTerms.length > 0 ||
  CATALOG_REPORT.duplicateTerms.length > 0 ||
  CATALOG_REPORT.missingTranslations.length > 0
) {
  process.exitCode = 1;
}

function loadTsModule(relativePath) {
  const filename = path.resolve(relativePath);
  const cache = new Map();

  function compileModule(moduleFilename) {
    const resolvedFilename = resolveTsFilename(moduleFilename);

    if (cache.has(resolvedFilename)) {
      return cache.get(resolvedFilename).exports;
    }

    const source = fs.readFileSync(resolvedFilename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        target: ts.ScriptTarget.ES2022,
        paths: { "@/*": ["src/*"] },
        baseUrl: process.cwd(),
      },
      fileName: resolvedFilename,
    }).outputText;
    const tsModule = new Module(resolvedFilename);
    const originalRequire = tsModule.require.bind(tsModule);

    cache.set(resolvedFilename, tsModule);
    tsModule.filename = resolvedFilename;
    tsModule.paths = Module._nodeModulePaths(path.dirname(resolvedFilename));
    tsModule.require = (request) => {
      if (request.startsWith("@/")) {
        return compileModule(path.resolve("src", request.slice(2)));
      }

      if (request.startsWith(".")) {
        return compileModule(path.resolve(path.dirname(resolvedFilename), request));
      }

      return originalRequire(request);
    };
    tsModule._compile(output, resolvedFilename);

    return tsModule.exports;
  }

  return compileModule(filename);
}

function resolveTsFilename(filename) {
  const candidates = [filename, `${filename}.ts`, `${filename}.tsx`, path.join(filename, "index.ts")];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());

  if (!resolved) {
    throw new Error(`Module bulunamadı: ${filename}`);
  }

  return resolved;
}

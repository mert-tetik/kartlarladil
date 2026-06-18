import fs from "node:fs";
import { Module } from "node:module";
import path from "node:path";
import ts from "typescript";

const { CATALOG_REPORT } = loadTsModule("src/data/cards.ts");

console.log("Geçersiz ana termler (ilk 30):");
for (const item of CATALOG_REPORT.invalidTerms.slice(0, 30)) {
  console.log(`  ${item.language} | ${item.term} | ${item.tier} | ${item.termKind} | ${item.id}`);
}

console.log("\nDuplicate termler (ilk 30):");
for (const item of CATALOG_REPORT.duplicateTerms.slice(0, 30)) {
  console.log(`  ${item.language} | "${item.term}" | ${item.ids.length} kart`);
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

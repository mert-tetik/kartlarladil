import fs from "node:fs";
import { Module } from "node:module";
import path from "node:path";
import util from "node:util";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const BATCH_SIZE = 500;

process.on("unhandledRejection", logFatalError);
process.on("uncaughtException", logFatalError);

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
  process.exit(1);
}

console.log("Kart katalog modulu yukleniyor...");
const { VOCABULARY_CARDS } = loadTsModule("src/data/cards.ts");
const { LANGUAGES } = loadTsModule("src/data/languages.ts");
console.log(`Kart katalog modulu yuklendi: ${VOCABULARY_CARDS.length} kart.`);
const importStartIndex = readIndexEnv("CARD_IMPORT_START_INDEX", 0);
const importEndIndex = Math.min(readIndexEnv("CARD_IMPORT_END_INDEX", VOCABULARY_CARDS.length), VOCABULARY_CARDS.length);

if (importStartIndex > importEndIndex) {
  throw new Error("CARD_IMPORT_START_INDEX, CARD_IMPORT_END_INDEX degerinden buyuk olamaz.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

console.log("Supabase kart kataloğu import ediliyor...");

console.log(`Import araligi: ${importStartIndex}-${importEndIndex}/${VOCABULARY_CARDS.length}`);

const { error: languageError } = await supabase.from("languages").upsert(
  LANGUAGES.map((language) => ({
    code: language.code,
    name: language.name,
    native_name: language.nativeName,
    accent: language.accent,
  })),
  { onConflict: "code" },
);

if (languageError) {
  throw languageError;
}

for (let index = importStartIndex; index < importEndIndex; index += BATCH_SIZE) {
  const batch = VOCABULARY_CARDS.slice(index, Math.min(index + BATCH_SIZE, importEndIndex)).map((card) => ({
    source_key: card.sourceKey,
    language_code: card.language,
    tier: card.tier,
    term: card.term,
    term_kind: card.termKind,
    translation_tr: card.translations.tr,
    translations: card.translations,
    pronunciation: card.pronunciation,
    part_of_speech: card.partOfSpeech,
    example: card.example,
    example_translation_tr: card.exampleTranslation,
    examples: card.examples,
    grammar: card.grammar,
    grammar_i18n: card.grammarByLocale,
  }));

  await upsertCardBatch(batch);

  console.log(`- ${Math.min(index + BATCH_SIZE, importEndIndex)}/${VOCABULARY_CARDS.length}`);
}

console.log(
  `Tamamlandı: ${importEndIndex - importStartIndex} kart araligi import edildi (${importStartIndex}-${importEndIndex}/${VOCABULARY_CARDS.length}).`,
);

async function upsertCardBatch(batch) {
  const { error } = await supabase.from("cards").upsert(batch, { onConflict: "language_code,term" });

  if (!error) {
    return;
  }

  if (!isRecoverableBatchError(error)) {
    throw error;
  }

  if (batch.length === 1) {
    await upsertCardRow(batch[0]);
    return;
  }

  const middleIndex = Math.floor(batch.length / 2);
  await upsertCardBatch(batch.slice(0, middleIndex));
  await upsertCardBatch(batch.slice(middleIndex));
}

function isConflictError(error) {
  return error.code === "23505" || error.code === "21000";
}

function isRecoverableBatchError(error) {
  return isConflictError(error) || error.code === "57014";
}

async function upsertCardRow(row) {
  const byTerm = await supabase.from("cards").upsert(row, { onConflict: "language_code,term" });

  if (!byTerm.error) {
    return;
  }

  if (!isConflictError(byTerm.error)) {
    throw byTerm.error;
  }

  const bySourceKey = await supabase.from("cards").upsert(row, { onConflict: "source_key" });

  if (!bySourceKey.error) {
    return;
  }

  throw {
    message: "Card row could not be imported.",
    row: {
      source_key: row.source_key,
      language_code: row.language_code,
      term: row.term,
    },
    byTerm: byTerm.error,
    bySourceKey: bySourceKey.error,
  };
}

function logFatalError(error) {
  console.error("Supabase card import failed:");
  console.error(formatError(error));
  process.exit(1);
}

function formatError(error) {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return util.inspect(error, { depth: 10, colors: false });
}

function readIndexEnv(name, fallback) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} sifir veya pozitif bir tamsayi olmali.`);
  }

  return value;
}

function loadEnvFile(filename) {
  const envPath = path.resolve(filename);

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();

    if (!key || (process.env[key] !== undefined && process.env[key] !== "")) {
      continue;
    }

    process.env[key] = stripEnvQuotes(rawValue);
  }
}

function stripEnvQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
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

import fs from "node:fs";
import path from "node:path";
import { Module } from "node:module";
import OpenAI from "openai";
import ts from "typescript";

const BATCH_SIZE = parsePositiveInt(process.env.CARD_TRANSLATION_MEANINGS_BATCH_SIZE) || 150;
const CONCURRENCY = parsePositiveInt(process.env.CARD_TRANSLATION_MEANINGS_CONCURRENCY) || 6;
const NON_ENGLISH_LOCALES = ["tr", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];
const PARTIAL_PATH = "scripts/data/card-translation-meanings.partial.json";
const OUTPUT_PATH = "src/data/card-translation-meanings.generated.ts";
const MODEL = process.env.OPENAI_CARD_TRANSLATION_MEANINGS_MODEL?.trim() || "gpt-5-nano";
const MAX_CARDS = parsePositiveInt(process.env.CARD_TRANSLATION_MEANINGS_LIMIT);
const EMIT_ONLY =
  process.env.CARD_TRANSLATION_MEANINGS_EMIT_ONLY === "1" || process.env.CARD_TRANSLATION_MEANINGS_EMIT_ONLY === "true";

loadEnvFile(".env.local");
loadEnvFile(".env");

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY required.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { masterCardEntries } = loadTsModule("src/data/card-seeds/master-list.ts");

const concepts = masterCardEntries.map((row) => {
  const [englishKey, tier, termKind, partOfSpeech] = row;

  return {
    meaningKey: createCardSourceKey("en", tier, englishKey, partOfSpeech, termKind),
    englishKey,
    tier,
    termKind,
    partOfSpeech,
    primaryTranslations: {
      tr: String(row[5] ?? ""),
      de: String(row[7] ?? ""),
      ru: String(row[8] ?? ""),
      fr: String(row[9] ?? ""),
      es: String(row[10] ?? ""),
      it: String(row[11] ?? ""),
      pt: String(row[12] ?? ""),
      nl: String(row[13] ?? ""),
      pl: String(row[14] ?? ""),
      ar: String(row[15] ?? ""),
      ja: String(row[16] ?? ""),
      ko: String(row[17] ?? ""),
      "zh-CN": String(row[18] ?? ""),
    },
  };
});

const existing = readPartial();

if (EMIT_ONLY) {
  writeOutput(existing);
  console.log(`Wrote ${OUTPUT_PATH} from existing partial data (${Object.keys(existing).length} items).`);
  process.exit(0);
}

const totalMissing = NON_ENGLISH_LOCALES.reduce(
  (count, locale) => count + concepts.filter((concept) => !isValidMeaningList(existing[concept.meaningKey]?.[locale])).length,
  0,
);
console.log(`Toplam concept: ${concepts.length}, eksik locale-slot: ${totalMissing}`);

for (const locale of NON_ENGLISH_LOCALES) {
  const pendingForLocale = concepts.filter((concept) => !isValidMeaningList(existing[concept.meaningKey]?.[locale]));
  const limitedPending = Number.isFinite(MAX_CARDS) ? pendingForLocale.slice(0, MAX_CARDS) : pendingForLocale;

  console.log(
    `[${locale}] mevcut: ${pendingForLocale.length - limitedPending.length}/${pendingForLocale.length}, uretilecek: ${limitedPending.length}` +
      (Number.isFinite(MAX_CARDS) ? ` (limit: ${MAX_CARDS})` : ""),
  );

  for (let index = 0; index < limitedPending.length; index += BATCH_SIZE * CONCURRENCY) {
    const currentBatches = [];

    for (let batchOffset = 0; batchOffset < CONCURRENCY; batchOffset += 1) {
      const batchStart = index + batchOffset * BATCH_SIZE;
      const batch = limitedPending.slice(batchStart, batchStart + BATCH_SIZE);
      if (batch.length > 0) {
        currentBatches.push(batch);
      }
    }

    const results = await Promise.all(currentBatches.map((batch) => generateBatch(locale, batch)));

    for (const result of results) {
      for (const item of result.items) {
        existing[item.meaningKey] ??= {};
        existing[item.meaningKey][locale] = item.meanings;
      }
    }

    writePartial(existing);
    console.log(`- [${locale}] ${Math.min(index + BATCH_SIZE * CONCURRENCY, limitedPending.length)}/${limitedPending.length}`);
  }
}

writeOutput(existing);
console.log(`Wrote ${OUTPUT_PATH}`);

async function generateBatch(locale, batch) {
  return generateBatchWithRetry(locale, batch, 1);
}

async function generateBatchWithRetry(locale, batch, attempt) {
  const prompt = [
    `You write up to 3 short translation meanings in ${locale} for each English vocabulary sense.`,
    "Rules:",
    "1. The English key identifies the exact intended sense; do not drift to a different sense.",
    "2. Return 1 to 3 natural translation meanings in priority order.",
    "3. Keep each meaning short. No explanations, examples, notes, numbering, or parentheses unless absolutely required by the language.",
    "4. Reuse the provided primary translation as the first meaning when it already fits the intended sense.",
    "5. Meanings must be unique.",
    '6. Return valid JSON only with this shape: {"items":[{"meaningKey":"...","meanings":["..."]}]}',
    "",
    "Concepts:",
    ...batch.map((concept) =>
      JSON.stringify({
        meaningKey: concept.meaningKey,
        englishKey: concept.englishKey,
        partOfSpeech: concept.partOfSpeech,
        termKind: concept.termKind,
        primaryTranslation: concept.primaryTranslations[locale],
      }),
    ),
  ].join("\n");

  const parsed = await requestBatchJson(locale, prompt, attempt, batch);

  const items = parsed.items
    .filter((item) => typeof item?.meaningKey === "string" && Array.isArray(item?.meanings))
    .map((item) => ({
      meaningKey: item.meaningKey,
      meanings: normalizeMeaningList(item.meanings),
    }))
    .filter((item) => isValidMeaningList(item.meanings));

  const byMeaningKey = new Map(items.map((item) => [item.meaningKey, item]));
  const missingConcepts = batch.filter((concept) => !byMeaningKey.has(concept.meaningKey));

  if (missingConcepts.length > 0) {
    if (attempt >= 3) {
      throw new Error(
        `Expected ${batch.length} items for ${locale}, got ${items.length}. Missing: ${missingConcepts.map((concept) => concept.meaningKey).join(", ")}`,
      );
    }

    const repaired = await generateMissingBatch(locale, missingConcepts, attempt + 1);
    for (const item of repaired.items) {
      byMeaningKey.set(item.meaningKey, item);
    }
  }

  return { items: batch.map((concept) => byMeaningKey.get(concept.meaningKey)).filter(Boolean) };
}

async function generateMissingBatch(locale, batch, attempt) {
  const prompt = [
    `You write up to 3 short translation meanings in ${locale} for each English vocabulary sense.`,
    "Rules:",
    "1. The English key identifies the exact intended sense; do not drift to a different sense.",
    "2. Return 1 to 3 natural translation meanings in priority order.",
    "3. Keep each meaning short. No explanations, examples, notes, numbering, or parentheses unless absolutely required by the language.",
    "4. Reuse the provided primary translation as the first meaning when it already fits the intended sense.",
    "5. Meanings must be unique.",
    '6. Return valid JSON only with this shape: {"items":[{"meaningKey":"...","meanings":["..."]}]}',
    "",
    "Fill only these missing concepts:",
    ...batch.map((concept) =>
      JSON.stringify({
        meaningKey: concept.meaningKey,
        englishKey: concept.englishKey,
        partOfSpeech: concept.partOfSpeech,
        termKind: concept.termKind,
        primaryTranslation: concept.primaryTranslations[locale],
      }),
    ),
  ].join("\n");

  const parsed = await requestBatchJson(locale, prompt, attempt, batch);

  const items = parsed.items
    .filter((item) => typeof item?.meaningKey === "string" && Array.isArray(item?.meanings))
    .map((item) => ({
      meaningKey: item.meaningKey,
      meanings: normalizeMeaningList(item.meanings),
    }))
    .filter((item) => isValidMeaningList(item.meanings));

  const byMeaningKey = new Map(items.map((item) => [item.meaningKey, item]));
  const missingConcepts = batch.filter((concept) => !byMeaningKey.has(concept.meaningKey));

  if (missingConcepts.length > 0 && attempt < 3) {
    const repaired = await generateMissingBatch(locale, missingConcepts, attempt + 1);
    for (const item of repaired.items) {
      byMeaningKey.set(item.meaningKey, item);
    }
  }

  return { items: batch.map((concept) => byMeaningKey.get(concept.meaningKey)).filter(Boolean) };
}

function normalizeMeaningList(value) {
  return [...new Set(
    value
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim().normalize("NFC"))
      .filter(Boolean),
  )].slice(0, 3);
}

function isValidMeaningList(value) {
  return Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "string" && entry.trim());
}

function parseBatchContent(content) {
  try {
    return JSON.parse(content);
  } catch {
    const firstBraceIndex = content.indexOf("{");
    const lastBraceIndex = content.lastIndexOf("}");

    if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
      try {
        return JSON.parse(content.slice(firstBraceIndex, lastBraceIndex + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
}

async function requestBatchJson(locale, prompt, attempt, batch) {
  try {
    const response = await createJsonCompletion(prompt);
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Model returned an empty response.");
    }

    const parsed = parseBatchContent(content);
    if (!parsed?.items || !Array.isArray(parsed.items)) {
      throw new Error("Invalid JSON shape.");
    }

    return parsed;
  } catch (error) {
    if (attempt < 3) {
      return requestBatchJson(locale, prompt, attempt + 1, batch);
    }

    if (batch.length > 1) {
      const midpoint = Math.ceil(batch.length / 2);
      const left = await generateBatchWithRetry(locale, batch.slice(0, midpoint), 1);
      const right = await generateBatchWithRetry(locale, batch.slice(midpoint), 1);
      return { items: [...left.items, ...right.items] };
    }

    throw error;
  }
}

async function createJsonCompletion(prompt, attempt = 1) {
  try {
    return await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
  } catch (error) {
    const status = error?.status ?? error?.response?.status;
    const code = error?.code;

    if ((status === 429 || code === "rate_limit_exceeded") && attempt < 6) {
      const delayMs = Math.min(8000, 500 * 2 ** (attempt - 1));
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return createJsonCompletion(prompt, attempt + 1);
    }

    throw error;
  }
}

function readPartial() {
  const filename = path.resolve(PARTIAL_PATH);
  if (!fs.existsSync(filename)) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(filename, "utf8"));
  return Object.fromEntries(
    Object.entries(parsed).map(([meaningKey, value]) => [
      meaningKey,
      Object.fromEntries(
        NON_ENGLISH_LOCALES.flatMap((locale) =>
          isValidMeaningList(value?.[locale]) ? [[locale, normalizeMeaningList(value[locale])]] : [],
        ),
      ),
    ]),
  );
}

function writePartial(data) {
  fs.mkdirSync(path.dirname(path.resolve(PARTIAL_PATH)), { recursive: true });
  fs.writeFileSync(path.resolve(PARTIAL_PATH), JSON.stringify(data, null, 2), "utf8");
}

function writeOutput(data) {
  const source = [
    "export const CARD_TRANSLATION_MEANINGS: Record<string, Partial<Record<string, string[]>>> = {",
    ...Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([meaningKey, translations]) => `  ${JSON.stringify(meaningKey)}: ${JSON.stringify(translations)},`),
    "};",
    "",
  ].join("\n");

  fs.writeFileSync(path.resolve(OUTPUT_PATH), source, "utf8");
}

function createCardSourceKey(language, tier, term, partOfSpeech, termKind = "word") {
  return [language, tier, termKind, encodeKeyPart(term), encodeKeyPart(partOfSpeech)].join(":");
}

function encodeKeyPart(value) {
  return encodeURIComponent(String(value ?? "").normalize("NFC").toLocaleLowerCase("en"));
}

function loadEnvFile(filename) {
  const envPath = path.resolve(filename);
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (!key || (process.env[key] !== undefined && process.env[key] !== "")) continue;

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
    throw new Error(`Module not found: ${filename}`);
  }

  return resolved;
}

function parsePositiveInt(value) {
  if (!value) {
    return Number.NaN;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
}

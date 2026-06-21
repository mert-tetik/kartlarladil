import fs from "node:fs";
import path from "node:path";
import { Module } from "node:module";
import OpenAI from "openai";
import ts from "typescript";

const BATCH_SIZE = parsePositiveInt(process.env.CARD_PRONUNCIATION_BATCH_SIZE) || 100;
const CONCURRENCY = parsePositiveInt(process.env.CARD_PRONUNCIATION_CONCURRENCY) || 8;
const CARD_SEED_LOCALE_ORDER = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];
const PARTIAL_PATH = "scripts/data/card-pronunciations.partial.json";
const OUTPUT_PATH = "src/data/card-pronunciations.generated.ts";
const MODEL = process.env.OPENAI_CARD_PRONUNCIATIONS_MODEL?.trim() || "gpt-5-nano";
const MAX_CARDS = parsePositiveInt(process.env.CARD_PRONUNCIATION_LIMIT);
const EMIT_ONLY =
  process.env.CARD_PRONUNCIATION_EMIT_ONLY === "1" || process.env.CARD_PRONUNCIATION_EMIT_ONLY === "true";

loadEnvFile(".env.local");
loadEnvFile(".env");

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY required.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { CARD_SEED_MODULES } = loadTsModule("src/data/card-seeds/index.ts");

const cards = CARD_SEED_MODULES.flatMap((module) =>
  module.rows.map((row) => {
    const [englishKey, tier, termKind, partOfSpeech] = row;
    const sourceKey = createCardSourceKey(module.language, tier, englishKey, partOfSpeech, termKind);

    return {
      sourceKey,
      language: module.language,
      tier,
      termKind,
      term: getLocalizedSeedTerm(row, module.language),
      englishKey,
      partOfSpeech,
    };
  }),
);

const existing = readPartial();
const pending = cards.filter((card) => !isValidPronunciation(existing[card.sourceKey]));
const limitedPending = Number.isFinite(MAX_CARDS) ? pending.slice(0, MAX_CARDS) : pending;

if (EMIT_ONLY) {
  writeOutput(existing);
  console.log(`Wrote ${OUTPUT_PATH} from existing partial data (${Object.keys(existing).length} items).`);
  process.exit(0);
}

console.log(
  `Toplam: ${cards.length}, mevcut: ${Object.keys(existing).length}, uretilecek: ${limitedPending.length}` +
    (Number.isFinite(MAX_CARDS) ? ` (limit: ${MAX_CARDS})` : ""),
);

function getLocalizedSeedTerm(row, language) {
  const localeIndex = CARD_SEED_LOCALE_ORDER.indexOf(language);
  return String(localeIndex >= 0 ? row[5 + localeIndex] ?? row[0] : row[0]);
}

for (let index = 0; index < limitedPending.length; index += BATCH_SIZE * CONCURRENCY) {
  const currentBatches = [];

  for (let batchOffset = 0; batchOffset < CONCURRENCY; batchOffset += 1) {
    const batchStart = index + batchOffset * BATCH_SIZE;
    const batch = limitedPending.slice(batchStart, batchStart + BATCH_SIZE);
    if (batch.length > 0) {
      currentBatches.push(batch);
    }
  }

  const results = await Promise.all(currentBatches.map((batch) => generateBatch(batch)));

  for (const result of results) {
    for (const item of result.items) {
      existing[item.sourceKey] = item.pronunciation;
    }
  }

  writePartial(existing);
  console.log(`- ${Math.min(index + BATCH_SIZE * CONCURRENCY, limitedPending.length)}/${limitedPending.length}`);
}

if (!Number.isFinite(MAX_CARDS) || limitedPending.length === pending.length) {
  writeOutput(existing);
  console.log(`Wrote ${OUTPUT_PATH}`);
} else {
  console.log(`Partial progress written to ${PARTIAL_PATH}`);
}

async function generateBatch(batch) {
  return generateBatchWithRetry(batch, 1);
}

async function generateBatchWithRetry(batch, attempt) {
  const prompt = [
    "You write one accurate IPA pronunciation for each vocabulary card term.",
    "Rules:",
    "1. Pronounce the card term itself in the card language, not the English lemma.",
    "2. Return exactly one broad IPA transcription per item.",
    "3. Wrap the IPA in forward slashes, like /.../.",
    "4. If the term is a phrase, transcribe the whole phrase naturally.",
    "5. Use the standard/common modern pronunciation for that language.",
    "6. Do not include explanations, alternate variants, notes, or plain-text respellings.",
    '7. Return valid JSON only with this shape: {"items":[{"sourceKey":"...","pronunciation":"/.../"}]}',
    "",
    "Cards:",
    ...batch.map((card) =>
      JSON.stringify({
        sourceKey: card.sourceKey,
        language: card.language,
        term: card.term,
        englishKey: card.englishKey,
        partOfSpeech: card.partOfSpeech,
        termKind: card.termKind,
      }),
    ),
  ].join("\n");

  const parsed = await requestBatchJson(prompt, attempt, batch);

  const items = parsed.items
    .filter((item) => typeof item?.sourceKey === "string" && typeof item?.pronunciation === "string")
    .map((item) => ({
      sourceKey: item.sourceKey,
      pronunciation: normalizePronunciation(item.pronunciation),
    }))
    .filter((item) => isValidPronunciation(item.pronunciation));

  const bySourceKey = new Map(items.map((item) => [item.sourceKey, item]));
  const missingCards = batch.filter((card) => !bySourceKey.has(card.sourceKey));

  if (missingCards.length > 0) {
    if (attempt >= 3) {
      throw new Error(
        `Expected ${batch.length} items, got ${items.length}. Missing: ${missingCards.map((card) => card.sourceKey).join(", ")}`,
      );
    }

    const repaired = await generateMissingBatch(missingCards, attempt + 1);
    for (const item of repaired.items) {
      bySourceKey.set(item.sourceKey, item);
    }
  }

  return { items: batch.map((card) => bySourceKey.get(card.sourceKey)).filter(Boolean) };
}

async function generateMissingBatch(batch, attempt) {
  const prompt = [
    "You write one accurate IPA pronunciation for each vocabulary card term.",
    "Rules:",
    "1. Pronounce the card term itself in the card language, not the English lemma.",
    "2. Return exactly one broad IPA transcription per item.",
    "3. Wrap the IPA in forward slashes, like /.../.",
    "4. If the term is a phrase, transcribe the whole phrase naturally.",
    "5. Use the standard/common modern pronunciation for that language.",
    "6. Do not include explanations, alternate variants, notes, or plain-text respellings.",
    '7. Return valid JSON only with this shape: {"items":[{"sourceKey":"...","pronunciation":"/.../"}]}',
    "",
    "Fill only these missing cards:",
    ...batch.map((card) =>
      JSON.stringify({
        sourceKey: card.sourceKey,
        language: card.language,
        term: card.term,
        englishKey: card.englishKey,
        partOfSpeech: card.partOfSpeech,
        termKind: card.termKind,
      }),
    ),
  ].join("\n");

  const parsed = await requestBatchJson(prompt, attempt, batch);

  const items = parsed.items
    .filter((item) => typeof item?.sourceKey === "string" && typeof item?.pronunciation === "string")
    .map((item) => ({
      sourceKey: item.sourceKey,
      pronunciation: normalizePronunciation(item.pronunciation),
    }))
    .filter((item) => isValidPronunciation(item.pronunciation));

  const bySourceKey = new Map(items.map((item) => [item.sourceKey, item]));
  const missingCards = batch.filter((card) => !bySourceKey.has(card.sourceKey));

  if (missingCards.length > 0 && attempt < 3) {
    const repaired = await generateMissingBatch(missingCards, attempt + 1);
    for (const item of repaired.items) {
      bySourceKey.set(item.sourceKey, item);
    }
  }

  return { items: batch.map((card) => bySourceKey.get(card.sourceKey)).filter(Boolean) };
}

function normalizePronunciation(value) {
  const trimmed = String(value ?? "").trim().normalize("NFC");

  if (/^\[.+\]$/u.test(trimmed)) {
    return `/${trimmed.slice(1, -1)}/`;
  }

  if (/^\/.+\/$/u.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

function isValidPronunciation(value) {
  return /^\/.+\/$/u.test(String(value ?? "").trim());
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

async function requestBatchJson(prompt, attempt, batch) {
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
      return requestBatchJson(prompt, attempt + 1, batch);
    }

    if (batch.length > 1) {
      const midpoint = Math.ceil(batch.length / 2);
      const left = await generateBatchWithRetry(batch.slice(0, midpoint), 1);
      const right = await generateBatchWithRetry(batch.slice(midpoint), 1);
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
    Object.entries(parsed).map(([sourceKey, value]) => [sourceKey, normalizePronunciation(value)]),
  );
}

function writePartial(data) {
  fs.mkdirSync(path.dirname(path.resolve(PARTIAL_PATH)), { recursive: true });
  fs.writeFileSync(path.resolve(PARTIAL_PATH), JSON.stringify(data, null, 2), "utf8");
}

function writeOutput(data) {
  const source = [
    "export const CARD_PRONUNCIATIONS: Record<string, string> = {",
    ...Object.entries(data)
      .filter(([, pronunciation]) => isValidPronunciation(pronunciation))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sourceKey, pronunciation]) => `  ${JSON.stringify(sourceKey)}: ${JSON.stringify(pronunciation)},`),
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

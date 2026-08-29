import fs from "node:fs";
import path from "node:path";
import { Module } from "node:module";
import OpenAI from "openai";
import ts from "typescript";

const COMMAND = (process.argv[2] || "submit").trim().toLowerCase();
const REQUEST_BATCH_SIZE = parsePositiveInt(process.env.CARD_PRONUNCIATION_REQUEST_BATCH_SIZE) || 80;
const MAX_REQUESTS_PER_BATCH = parsePositiveInt(process.env.CARD_PRONUNCIATION_MAX_REQUESTS_PER_BATCH) || 200;
const CARD_SEED_LOCALE_ORDER = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];
const PARTIAL_PATH = "scripts/data/card-pronunciations.partial.json";
const OUTPUT_PATH = "src/data/card-pronunciations.generated.ts";
const INPUT_JSONL_PATH = "scripts/data/card-pronunciations.batch-input.jsonl";
const RESULT_JSONL_PATH = "scripts/data/card-pronunciations.batch-output.jsonl";
const ERROR_JSONL_PATH = "scripts/data/card-pronunciations.batch-errors.jsonl";
const MANIFEST_PATH = "scripts/data/card-pronunciations.batch-manifest.json";

loadEnvFile(".env.local");
loadEnvFile(".env");

const MODEL = process.env.OPENAI_CARD_PRONUNCIATIONS_MODEL?.trim() || "gpt-5.4-nano";

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

switch (COMMAND) {
  case "submit":
    await submitBatch();
    break;
  case "status":
    await printBatchStatus();
    break;
  case "apply":
    await applyBatchResults();
    break;
  default:
    console.error(`Unknown command: ${COMMAND}. Use submit, status, or apply.`);
    process.exit(1);
}

async function submitBatch() {
  const existing = readPartial();
  const pending = cards.filter((card) => !isValidPronunciation(existing[card.sourceKey]));

  if (pending.length === 0) {
    writeOutput(existing);
    console.log(`No pending pronunciation cards. Wrote ${OUTPUT_PATH}.`);
    return;
  }

  const pendingForBatch = pending.slice(0, REQUEST_BATCH_SIZE * MAX_REQUESTS_PER_BATCH);
  const requests = chunk(pendingForBatch, REQUEST_BATCH_SIZE).map((batch, index) => ({
    custom_id: `pronunciation-${String(index + 1).padStart(5, "0")}`,
    method: "POST",
    url: "/v1/chat/completions",
      body: {
      model: MODEL,
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
      messages: [{ role: "user", content: buildPrompt(batch) }],
    },
  }));

  ensureParentDir(INPUT_JSONL_PATH);
  fs.writeFileSync(
    path.resolve(INPUT_JSONL_PATH),
    requests.map((request) => JSON.stringify(request)).join("\n") + "\n",
    "utf8",
  );

  const file = await openai.files.create({
    file: fs.createReadStream(path.resolve(INPUT_JSONL_PATH)),
    purpose: "batch",
  });

  const batch = await openai.batches.create({
    input_file_id: file.id,
    endpoint: "/v1/chat/completions",
    completion_window: "24h",
    metadata: {
      generator: "card-pronunciations",
      model: MODEL,
    },
  });

  const manifest = {
    kind: "card-pronunciations",
    model: MODEL,
    requestBatchSize: REQUEST_BATCH_SIZE,
    cardCount: pendingForBatch.length,
    remainingCardCount: pending.length - pendingForBatch.length,
    requestCount: requests.length,
    batchId: batch.id,
    inputFileId: file.id,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.resolve(MANIFEST_PATH), JSON.stringify(manifest, null, 2), "utf8");

  console.log(JSON.stringify(manifest, null, 2));
}

async function printBatchStatus() {
  const manifest = readManifest();
  const batch = await openai.batches.retrieve(manifest.batchId);

  console.log(
    JSON.stringify(
      {
        batchId: batch.id,
        status: batch.status,
        errors: batch.errors ?? null,
        error: batch.error ?? null,
        requestCounts: batch.request_counts ?? null,
        inputFileId: batch.input_file_id,
        outputFileId: batch.output_file_id ?? null,
        errorFileId: batch.error_file_id ?? null,
        createdAt: batch.created_at,
        completedAt: batch.completed_at ?? null,
      },
      null,
      2,
    ),
  );
}

async function applyBatchResults() {
  const manifest = readManifest();
  const batch = await openai.batches.retrieve(manifest.batchId);

  if (!batch.output_file_id) {
    throw new Error(`Batch ${batch.id} does not have an output file yet. Current status: ${batch.status}`);
  }

  const existing = readPartial();
  const expectedSourceKeys = new Set(
    cards.filter((card) => !isValidPronunciation(existing[card.sourceKey])).map((card) => card.sourceKey),
  );
  const outputResponse = await openai.files.content(batch.output_file_id);
  const outputText = await outputResponse.text();
  ensureParentDir(RESULT_JSONL_PATH);
  fs.writeFileSync(path.resolve(RESULT_JSONL_PATH), outputText, "utf8");

  let parsedLines = 0;
  let mergedItems = 0;
  let invalidLines = 0;
  let ignoredItems = 0;

  for (const line of outputText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    parsedLines += 1;

    const record = JSON.parse(trimmed);
    const content = record?.response?.body?.choices?.[0]?.message?.content;
    if (!content) {
      invalidLines += 1;
      continue;
    }

    const parsed = parseBatchContent(content);
    if (!parsed?.items || !Array.isArray(parsed.items)) {
      invalidLines += 1;
      continue;
    }

    for (const item of parsed.items) {
      if (typeof item?.sourceKey !== "string" || typeof item?.pronunciation !== "string") {
        ignoredItems += 1;
        continue;
      }

      if (!expectedSourceKeys.has(item.sourceKey)) {
        ignoredItems += 1;
        continue;
      }

      const pronunciation = normalizePronunciation(item.pronunciation);
      if (!isValidPronunciation(pronunciation)) {
        ignoredItems += 1;
        continue;
      }

      if (existing[item.sourceKey] === pronunciation) continue;
      existing[item.sourceKey] = pronunciation;
      mergedItems += 1;
    }
  }

  if (batch.error_file_id) {
    const errorResponse = await openai.files.content(batch.error_file_id);
    const errorText = await errorResponse.text();
    ensureParentDir(ERROR_JSONL_PATH);
    fs.writeFileSync(path.resolve(ERROR_JSONL_PATH), errorText, "utf8");
  }

  const missingCount = [...expectedSourceKeys].filter((sourceKey) => !isValidPronunciation(existing[sourceKey])).length;

  writePartial(existing);
  writeOutput(existing);

  console.log(
    JSON.stringify(
      {
        batchId: batch.id,
        status: batch.status,
        parsedLines,
        mergedItems,
        ignoredItems,
        invalidLines,
        missingCount,
        pronunciationCount: Object.keys(existing).length,
      },
      null,
      2,
    ),
  );
}

function buildPrompt(batch) {
  return [
    "You create a simple Turkish-reader pronunciation respelling for each vocabulary card term.",
    "The pronunciation is written for a Turkish speaker to read aloud, but it must represent the actual pronunciation of the term in its target card language.",
    "Rules:",
    "1. Pronounce the card term itself in the target card language, not the English lemma and not a translation.",
    "2. Return exactly one pronunciation per item using lowercase Latin characters only, plus Turkish dotless ı when needed.",
    "3. Never use IPA, slashes, brackets, stress marks, diacritics, Cyrillic, Arabic, Greek, Japanese, Korean, or Chinese characters.",
    "4. Use only a-z, ı, spaces, apostrophes, and hyphens in pronunciation values.",
    "5. Write every sound so a Turkish reader can pronounce it approximately correctly. Preserve pronounced final consonants and all important sounds.",
    "6. For a w sound use v, for a Turkish ç-like sound use ch, and for a Turkish ş-like sound use sh. Convert x according to its actual sound; never copy x blindly.",
    "7. Target-language rules matter: do not force English pronunciation onto German, Russian, French, Spanish, Italian, Portuguese, Dutch, Polish, Arabic, Japanese, Korean, or Chinese terms.",
    "8. For non-Latin scripts, transliterate the target-language pronunciation into the allowed Latin spelling. For phrases, preserve the word order and pronounce the whole phrase.",
    "9. Important examples: box -> baks, fox -> faks, socks -> saks, six -> siks, exam -> igzam. The output 'bok' for box is invalid.",
    "10. Do not include explanations, alternate variants, notes, punctuation, or surrounding quotes in pronunciation values.",
    '11. Return valid JSON only with this exact shape: {"items":[{"sourceKey":"...","pronunciation":"..."}]}',
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
}

function getLocalizedSeedTerm(row, language) {
  const localeIndex = CARD_SEED_LOCALE_ORDER.indexOf(language);
  return String(localeIndex >= 0 ? row[5 + localeIndex] ?? row[0] : row[0]);
}

function normalizePronunciation(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFC")
    .toLocaleLowerCase("tr")
    .replaceAll("w", "v")
    .replaceAll("ç", "ch")
    .replaceAll("ş", "sh")
    .replace(/\s+/gu, " ");
}

function isValidPronunciation(value) {
  return /^[a-z\u0131]+(?:[ '-][a-z\u0131]+)*$/u.test(String(value ?? "").trim());
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

function readManifest() {
  if (!fs.existsSync(path.resolve(MANIFEST_PATH))) {
    throw new Error(`Manifest not found: ${MANIFEST_PATH}`);
  }

  return JSON.parse(fs.readFileSync(path.resolve(MANIFEST_PATH), "utf8"));
}

function readPartial() {
  const filename = path.resolve(PARTIAL_PATH);
  if (!fs.existsSync(filename)) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(filename, "utf8"));
  return Object.fromEntries(
    Object.entries(parsed)
      .map(([sourceKey, value]) => [sourceKey, normalizePronunciation(value)])
      .filter(([, value]) => isValidPronunciation(value)),
  );
}

function writePartial(data) {
  ensureParentDir(PARTIAL_PATH);
  const validData = Object.fromEntries(
    Object.entries(data).filter(([, pronunciation]) => isValidPronunciation(pronunciation)),
  );
  fs.writeFileSync(path.resolve(PARTIAL_PATH), JSON.stringify(validData, null, 2), "utf8");
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

function chunk(items, size) {
  const result = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function ensureParentDir(relativePath) {
  fs.mkdirSync(path.dirname(path.resolve(relativePath)), { recursive: true });
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

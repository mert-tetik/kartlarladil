import fs from "node:fs";
import path from "node:path";
import { Module } from "node:module";
import OpenAI from "openai";
import ts from "typescript";

const COMMAND = (process.argv[2] || "submit").trim().toLowerCase();
const REQUEST_BATCH_SIZE = parsePositiveInt(process.env.CARD_DEFINITIONS_REQUEST_BATCH_SIZE) || 100;
const MAX_REQUESTS_PER_BATCH = parsePositiveInt(process.env.CARD_DEFINITIONS_MAX_REQUESTS_PER_BATCH) || 50;
const LOCALES = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];
const CARD_SEED_LOCALE_ORDER = LOCALES;
const PARTIAL_PATH = "scripts/data/card-definitions.partial.json";
const OUTPUT_PATH = "src/data/card-definitions.generated.ts";
const INPUT_DIR = "scripts/data/card-definitions-batches";
const RESULT_JSONL_PATH = "scripts/data/card-definitions.batch-output.jsonl";
const ERROR_JSONL_PATH = "scripts/data/card-definitions.batch-errors.jsonl";
const MANIFEST_PATH = "scripts/data/card-definitions.batch-manifest.json";

loadEnvFile(".env.local");
loadEnvFile(".env");

const MODEL = process.env.OPENAI_CARD_DEFINITIONS_MODEL?.trim() || "gpt-5.4-nano";

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY required.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { masterCardEntries } = loadTsModule("src/data/card-seeds/master-list.ts");

const concepts = masterCardEntries.map((row) => {
  const [englishKey, tier, termKind, partOfSpeech] = row;

  return {
    definitionKey: createCardSourceKey("en", tier, englishKey, partOfSpeech, termKind),
    englishKey,
    tier,
    termKind,
    partOfSpeech,
    translations: Object.fromEntries(
      CARD_SEED_LOCALE_ORDER.map((locale, index) => [locale, String(row[5 + index] ?? row[0] ?? "")]),
    ),
  };
});

switch (COMMAND) {
  case "submit":
  case "retry":
    await submitBatch();
    break;
  case "status":
    await printBatchStatus();
    break;
  case "apply":
    await applyBatchResults();
    break;
  default:
    console.error(`Unknown command: ${COMMAND}. Use submit, retry, status, or apply.`);
    process.exit(1);
}

async function submitBatch() {
  const existing = readPartial();
  const requestSpecs = [];

  for (const locale of LOCALES) {
    const pending = concepts.filter((concept) => !isValidDefinition(existing[concept.definitionKey]?.[locale]));
    const batches = chunk(pending, REQUEST_BATCH_SIZE);

    batches.forEach((batch, index) => {
      requestSpecs.push({
        custom_id: `definitions|${locale}|${String(index + 1).padStart(5, "0")}`,
        method: "POST",
        url: "/v1/chat/completions",
        body: {
          model: MODEL,
          response_format: { type: "json_object" },
          max_completion_tokens: 4096,
          messages: [{ role: "user", content: buildPrompt(locale, batch) }],
        },
      });
    });
  }

  if (requestSpecs.length === 0) {
    writeOutput(existing);
    console.log(`No pending card-definition requests. Wrote ${OUTPUT_PATH}.`);
    return;
  }

  const requestBatches = chunk(requestSpecs, MAX_REQUESTS_PER_BATCH);
  const submittedBatches = [];

  for (const [index, requests] of requestBatches.entries()) {
    const inputPath = path.join(
      INPUT_DIR,
      `card-definitions-${String(index + 1).padStart(3, "0")}.jsonl`,
    );
    ensureParentDir(inputPath);
    fs.writeFileSync(
      path.resolve(inputPath),
      requests.map((request) => JSON.stringify(request)).join("\n") + "\n",
      "utf8",
    );

    const uploadedFile = await openai.files.create({
      file: fs.createReadStream(path.resolve(inputPath)),
      purpose: "batch",
    });
    const file = await waitForBatchInputFile(uploadedFile.id);
    const batch = await openai.batches.create({
      input_file_id: file.id,
      endpoint: "/v1/chat/completions",
      completion_window: "24h",
      metadata: {
        generator: "card-definitions",
        model: MODEL,
        part: String(index + 1),
      },
    });

    submittedBatches.push({
      batchId: batch.id,
      inputFileId: file.id,
      inputPath,
      requestCount: requests.length,
    });
    console.log(`Submitted definition batch ${index + 1}/${requestBatches.length}: ${batch.id}`);
  }

  const manifest = {
    kind: "card-definitions",
    model: MODEL,
    requestBatchSize: REQUEST_BATCH_SIZE,
    maxRequestsPerBatch: MAX_REQUESTS_PER_BATCH,
    requestCount: requestSpecs.length,
    conceptCount: concepts.length,
    localeCount: LOCALES.length,
    batchCount: submittedBatches.length,
    batches: submittedBatches,
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.resolve(MANIFEST_PATH), JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

async function printBatchStatus() {
  const manifest = readManifest();
  const statuses = [];

  for (const entry of getManifestBatches(manifest)) {
    const batch = await openai.batches.retrieve(entry.batchId);
    statuses.push({
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
    });
  }

  console.log(JSON.stringify({
    batchCount: statuses.length,
    statuses,
  }, null, 2));
}

async function applyBatchResults() {
  const manifest = readManifest();
  const batches = [];
  const pendingBatches = [];

  for (const entry of getManifestBatches(manifest)) {
    const batch = await openai.batches.retrieve(entry.batchId);
    if (!batch.output_file_id) {
      pendingBatches.push({ batchId: batch.id, status: batch.status });
      continue;
    }
    batches.push(batch);
  }

  if (batches.length === 0) {
    throw new Error(`No completed definition batches are ready to apply. Pending: ${JSON.stringify(pendingBatches)}`);
  }

  const existing = readPartial();
  const expectedByLocale = new Map(
    LOCALES.map((locale) => [
      locale,
      new Set(concepts
        .filter((concept) => !isValidDefinition(existing[concept.definitionKey]?.[locale]))
        .map((concept) => concept.definitionKey)),
    ]),
  );
  let parsedLines = 0;
  let mergedItems = 0;
  let invalidLines = 0;
  let ignoredItems = 0;
  const outputParts = [];

  for (const batch of batches) {
    const outputResponse = await openai.files.content(batch.output_file_id);
    const outputText = await outputResponse.text();
    outputParts.push(outputText);

    for (const line of outputText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    parsedLines += 1;

    let record;
    try {
      record = JSON.parse(trimmed);
    } catch {
      invalidLines += 1;
      continue;
    }

    const content = record?.response?.body?.choices?.[0]?.message?.content;
    const locale = getLocaleFromCustomId(record?.custom_id);
    if (!content || !locale) {
      invalidLines += 1;
      continue;
    }

    const parsed = parseBatchContent(content);
    if (!parsed?.items || !Array.isArray(parsed.items)) {
      invalidLines += 1;
      continue;
    }

    for (const item of parsed.items) {
      const definitionKey = typeof item?.definitionKey === "string" ? item.definitionKey : "";
      const definition = normalizeDefinition(item?.definition);
      const expectedKeys = expectedByLocale.get(locale);

      if (!expectedKeys?.has(definitionKey) || !isValidDefinition(definition)) {
        ignoredItems += 1;
        continue;
      }

      existing[definitionKey] ??= {};
      existing[definitionKey][locale] = definition;
      expectedKeys.delete(definitionKey);
      mergedItems += 1;
    }
  }
  }

  const errorParts = [];
  for (const batch of batches) {
    if (!batch.error_file_id) continue;
    const errorResponse = await openai.files.content(batch.error_file_id);
    errorParts.push(await errorResponse.text());
  }
  if (errorParts.length > 0) {
    ensureParentDir(ERROR_JSONL_PATH);
    fs.writeFileSync(path.resolve(ERROR_JSONL_PATH), errorParts.join("\n"), "utf8");
  }

  ensureParentDir(RESULT_JSONL_PATH);
  fs.writeFileSync(path.resolve(RESULT_JSONL_PATH), outputParts.join("\n"), "utf8");
  writePartial(existing);
  writeOutput(existing);

  const missingCount = [...expectedByLocale.values()]
    .reduce((total, missing) => total + missing.size, 0);

  console.log(JSON.stringify({
    batchIds: batches.map((batch) => batch.id),
    statuses: batches.map((batch) => batch.status),
    parsedLines,
    mergedItems,
    ignoredItems,
    invalidLines,
    missingCount,
    pendingBatches,
    definitionCount: Object.values(existing).reduce(
      (total, locales) => total + Object.keys(locales).length,
      0,
    ),
  }, null, 2));
}

function buildPrompt(locale, batch) {
  return [
    `You create concise, learner-friendly dictionary definitions in ${locale} for FoxiesDeck vocabulary concepts.`,
    "Each definition will be used as the correct answer in a four-choice vocabulary question.",
    "The target-language term is shown to the learner; answer choices are written in the learner's native language.",
    "Rules:",
    "1. Write exactly one definition for the exact sense identified by englishKey, partOfSpeech, termKind, and primaryTranslation.",
    "2. Write the definition in the requested language, not in another language.",
    "3. Explain the concept clearly instead of merely repeating the translation or target term.",
    "4. Keep it short: one natural sentence or a short phrase, preferably 3-12 words.",
    "5. Do not include examples, synonyms, alternate meanings, pronunciation, labels, numbering, quotes, or meta commentary.",
    "6. Do not use the target English key or its obvious spelling variant inside the definition unless it is unavoidable in the requested language.",
    "7. Return exactly one result per input concept, preserve definitionKey, and return valid JSON only with this shape: {\"items\":[{\"definitionKey\":\"...\",\"definition\":\"...\"}]}",
    "",
    "Concepts:",
    ...batch.map((concept) => JSON.stringify({
      definitionKey: concept.definitionKey,
      englishKey: concept.englishKey,
      tier: concept.tier,
      termKind: concept.termKind,
      partOfSpeech: concept.partOfSpeech,
      primaryTranslation: concept.translations[locale],
    })),
  ].join("\n");
}

function getLocaleFromCustomId(customId) {
  if (typeof customId !== "string") return null;
  const parts = customId.split("|");
  return LOCALES.includes(parts[1]) ? parts[1] : null;
}

function normalizeDefinition(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFC")
    .replace(/\s+/gu, " ");
}

function isValidDefinition(value) {
  const normalized = normalizeDefinition(value);
  return normalized.length >= 2 && normalized.length <= 240 && !/[\u0000-\u001F]/u.test(normalized);
}

function parseBatchContent(content) {
  try {
    return JSON.parse(content);
  } catch {
    const firstBraceIndex = content.indexOf("{");
    const lastBraceIndex = content.lastIndexOf("}");
    if (firstBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
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

function getManifestBatches(manifest) {
  if (Array.isArray(manifest?.batches) && manifest.batches.length > 0) {
    return manifest.batches;
  }

  if (typeof manifest?.batchId === "string" && manifest.batchId) {
    return [{
      batchId: manifest.batchId,
      inputFileId: manifest.inputFileId ?? null,
      requestCount: manifest.requestCount ?? null,
    }];
  }

  throw new Error(`No batch IDs found in ${MANIFEST_PATH}.`);
}

function readPartial() {
  const filename = path.resolve(PARTIAL_PATH);
  if (!fs.existsSync(filename)) return {};

  const parsed = JSON.parse(fs.readFileSync(filename, "utf8"));
  return Object.fromEntries(
    Object.entries(parsed).map(([definitionKey, locales]) => [
      definitionKey,
      Object.fromEntries(
        LOCALES.flatMap((locale) => {
          const definition = normalizeDefinition(locales?.[locale]);
          return isValidDefinition(definition) ? [[locale, definition]] : [];
        }),
      ),
    ]),
  );
}

function writePartial(data) {
  ensureParentDir(PARTIAL_PATH);
  fs.writeFileSync(path.resolve(PARTIAL_PATH), JSON.stringify(data, null, 2), "utf8");
}

function writeOutput(data) {
  const source = [
    "export const CARD_DEFINITIONS: Record<string, Partial<Record<string, string>>> = {",
    ...Object.entries(data)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([definitionKey, locales]) => `  ${JSON.stringify(definitionKey)}: ${JSON.stringify(locales)},`),
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

async function waitForBatchInputFile(fileId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const file = await openai.files.retrieve(fileId);

    if (file.status === "processed") return file;
    if (file.status === "error") {
      throw new Error(`Batch input file ${fileId} failed processing: ${file.status_details ?? "unknown error"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Batch input file ${fileId} was not processed within 60 seconds.`);
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
    if (cache.has(resolvedFilename)) return cache.get(resolvedFilename).exports;

    const source = fs.readFileSync(resolvedFilename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: resolvedFilename,
    }).outputText;

    const tsModule = new Module(resolvedFilename);
    const originalRequire = tsModule.require.bind(tsModule);
    cache.set(resolvedFilename, tsModule);
    tsModule.filename = resolvedFilename;
    tsModule.paths = Module._nodeModulePaths(path.dirname(resolvedFilename));
    tsModule.require = (request) => {
      if (request.startsWith("@/")) return compileModule(path.resolve("src", request.slice(2)));
      if (request.startsWith(".")) return compileModule(path.resolve(path.dirname(resolvedFilename), request));
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
  if (!resolved) throw new Error(`Module not found: ${filename}`);
  return resolved;
}

function parsePositiveInt(value) {
  if (!value) return Number.NaN;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.NaN;
}

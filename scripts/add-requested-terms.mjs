import fs from "node:fs";
import path from "node:path";
import { Module } from "node:module";
import OpenAI from "openai";
import ts from "typescript";

const MODEL = process.env.OPENAI_TERM_ADDER_MODEL?.trim() || "gpt-5-nano";
const EXAMPLE_MODEL = process.env.OPENAI_CARD_EXAMPLES_MODEL?.trim() || "gpt-5.4-nano";
const PRONUNCIATION_MODEL = process.env.OPENAI_CARD_PRONUNCIATIONS_MODEL?.trim() || "gpt-5-nano";
const MEANING_MODEL = process.env.OPENAI_CARD_TRANSLATION_MEANINGS_MODEL?.trim() || "gpt-5-nano";
const CARD_SEED_LOCALE_ORDER = ["tr", "en", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];
const NON_ENGLISH_LOCALES = ["tr", "de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];
const REQUESTED_TERMS = [
  "angry", "furious", "tired", "exhausted", "hungry", "starving", "scared", "terrified", "pretty", "beautiful",
  "gorgeous", "cute", "hot", "like", "love", "adore", "dislike", "hate", "detest", "despise", "sad", "upset",
  "depressed", "alone", "lonely", "jealous", "envious", "shy", "introverted", "confident", "arrogant", "childish",
  "childlike", "cheap", "affordable", "slim", "skinny", "old", "elderly", "house", "home", "job", "work", "career",
  "speak", "talk", "tell", "say", "look", "see", "watch", "hear", "listen", "fun", "funny", "bored", "boring",
  "interested", "interesting", "remember", "remind", "borrow", "lend", "miss", "lose", "make", "do", "trip",
  "travel", "journey", "street", "road", "avenue", "mistake", "fault", "difficult", "hard", "big", "large", "great",
  "small", "little", "maybe", "probably", "definitely", "must", "have to", "should", "had better", "stop doing",
  "stop to do", "try doing", "try to do", "used to", "be used to", "actually", "currently", "eventually", "possibly",
  "sensitive", "sensible", "fabric", "factory",
];
const BATCH_SIZE = 24;

loadEnvFile(".env.local");
loadEnvFile(".env");

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY required.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { CARD_EXAMPLE_SENTENCES } = loadTsModule("src/data/card-examples.generated.ts");
const { CARD_PRONUNCIATIONS } = loadTsModule("src/data/card-pronunciations.generated.ts");
const { CARD_TRANSLATION_MEANINGS } = loadTsModule("src/data/card-translation-meanings.generated.ts");
const { masterCardEntries } = loadTsModule("src/data/card-seeds/master-list.ts");

const existingTerms = new Set(masterCardEntries.map((row) => String(row[0]).toLocaleLowerCase("en")));
const missingTerms = REQUESTED_TERMS.filter((term) => !existingTerms.has(term.toLocaleLowerCase("en")));

let targetRows;

if (missingTerms.length > 0) {
  console.log(`Missing terms (${missingTerms.length}): ${missingTerms.join(", ")}`);
  const newRows = await requestTermRows(missingTerms);
  appendRowsToMasterList(newRows);
  targetRows = newRows;
} else {
  targetRows = getRowsNeedingGeneratedDetails(masterCardEntries, CARD_EXAMPLE_SENTENCES);
  if (targetRows.length === 0) {
    console.log("No missing terms to add and no requested rows need generated details.");
    process.exit(0);
  }
  console.log(`Resuming generated details for ${targetRows.length} requested terms.`);
}

const localizedCards = buildLocalizedCards(targetRows);
const exampleMap = { ...CARD_EXAMPLE_SENTENCES };
const pronunciationMap = { ...CARD_PRONUNCIATIONS };
const meaningMap = { ...CARD_TRANSLATION_MEANINGS };

await fillExamples(localizedCards, exampleMap);
await fillPronunciations(localizedCards, pronunciationMap);
await fillMeanings(newRows, meaningMap);

writeExamples(exampleMap);
writePronunciations(pronunciationMap);
writeMeanings(meaningMap);

console.log(`Completed ${targetRows.length} requested terms.`);

async function requestTermRows(terms) {
  const prompt = [
    "You create multilingual vocabulary seed rows for a language learning card catalog.",
    "Return valid JSON only with this shape:",
    '{"items":[{"englishKey":"...","tier":"A1|A2|B1|B2|C1","termKind":"word|fixed_phrase","partOfSpeech":"...","pronunciation":"/.../","translations":{"tr":"...","en":"...","de":"...","ru":"...","fr":"...","es":"...","it":"...","pt":"...","nl":"...","pl":"...","ar":"...","ja":"...","ko":"...","zh-CN":"..."}}]}',
    "Rules:",
    "1. Use conservative CEFR tiers for practical learners.",
    "2. Use fixed_phrase only for multi-word items. Single words must be word.",
    "3. partOfSpeech should be a simple lowercase label such as adjective, noun, verb, adverb, phrase.",
    "4. Provide one English IPA pronunciation in /slashes/ for the English term or phrase.",
    "5. Keep translations natural and learner-friendly in each language.",
    "6. For phrase items, translate the actual construction/pattern, not a dictionary gloss.",
    "7. Preserve the exact englishKey strings from the requested list.",
    "8. Ensure en translation exactly equals englishKey.",
    "",
    "Requested terms:",
    ...terms.map((term) => `- ${term}`),
  ].join("\n");

  const parsed = await createJsonCompletion(MODEL, prompt);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];

  if (items.length !== terms.length) {
    throw new Error(`Expected ${terms.length} rows, got ${items.length}.`);
  }

  return items.map(normalizeRowItem);
}

function normalizeRowItem(item) {
  const translations = item?.translations ?? {};
  const row = {
    englishKey: String(item.englishKey ?? "").trim(),
    tier: String(item.tier ?? "").trim(),
    termKind: String(item.termKind ?? "").trim(),
    partOfSpeech: String(item.partOfSpeech ?? "").trim().toLocaleLowerCase("en"),
    pronunciation: normalizePronunciation(String(item.pronunciation ?? "").trim()),
    translations: Object.fromEntries(CARD_SEED_LOCALE_ORDER.map((locale) => [locale, String(translations[locale] ?? "").trim()])),
  };

  if (!row.englishKey || !row.tier || !row.termKind || !row.partOfSpeech || !row.pronunciation) {
    throw new Error(`Invalid row payload for ${JSON.stringify(item)}`);
  }

  if (row.translations.en !== row.englishKey) {
    row.translations.en = row.englishKey;
  }

  for (const locale of CARD_SEED_LOCALE_ORDER) {
    if (!row.translations[locale]) {
      throw new Error(`Missing ${locale} translation for ${row.englishKey}`);
    }
  }

  return row;
}

function appendRowsToMasterList(rows) {
  const filePath = path.resolve("src/data/card-seeds/master-list.ts");
  const source = fs.readFileSync(filePath, "utf8");
  const marker = "] as const satisfies readonly CardSeedRow[];";
  const insertion = rows
    .map((row) => {
      const values = [
        row.englishKey,
        row.tier,
        row.termKind,
        row.partOfSpeech,
        row.pronunciation,
        ...CARD_SEED_LOCALE_ORDER.map((locale) => row.translations[locale]),
      ];
      return `  [${values.map((value) => JSON.stringify(value)).join(",")}],`;
    })
    .join("\n");

  if (!source.includes(marker)) {
    throw new Error("Could not find master list marker.");
  }

  const next = source.replace(marker, `${insertion}\n${marker}`);
  fs.writeFileSync(filePath, next);
}

function buildLocalizedCards(rows) {
  return rows.flatMap((row) =>
    CARD_SEED_LOCALE_ORDER.map((language) => ({
      sourceKey: createCardSourceKey(language, row.tier, row.englishKey, row.partOfSpeech, row.termKind),
      language,
      term: row.translations[language],
      englishKey: row.englishKey,
      tier: row.tier,
      termKind: row.termKind,
      partOfSpeech: row.partOfSpeech,
    })),
  );
}

function getRowsNeedingGeneratedDetails(rows, exampleMap) {
  const requestedSet = new Set(REQUESTED_TERMS.map((term) => term.toLocaleLowerCase("en")));
  return rows
    .filter((row) => requestedSet.has(String(row[0]).toLocaleLowerCase("en")))
    .filter((row) =>
      CARD_SEED_LOCALE_ORDER.some((language) => {
        const sourceKey = createCardSourceKey(language, row[1], row[0], row[3], row[2]);
        return !hasValidExampleSet(exampleMap[sourceKey]);
      }),
    )
    .map((row) => ({
      englishKey: String(row[0]),
      tier: String(row[1]),
      termKind: String(row[2]),
      partOfSpeech: String(row[3]),
      pronunciation: String(row[4]),
      translations: Object.fromEntries(CARD_SEED_LOCALE_ORDER.map((locale, index) => [locale, String(row[5 + index])])),
    }));
}

async function fillExamples(cards, target) {
  const pending = cards.filter((card) => !hasValidExampleSet(target[card.sourceKey]));

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const prompt = [
      "You write two real, natural, different example sentences for each vocabulary card.",
      "Rules:",
      "1. Use the card language only.",
      "2. Write exactly two sentences per item.",
      "3. The two sentences for the same item must be clearly different.",
      "4. No template wording, no placeholders, no explanations.",
      '5. Return valid JSON only with this shape: {"items":[{"sourceKey":"...","sentences":["...","..."]}]}',
      "",
      "Cards:",
      ...batch.map((card) => JSON.stringify(card)),
    ].join("\n");

    const parsed = await createJsonCompletion(EXAMPLE_MODEL, prompt);
    for (const item of parsed.items ?? []) {
      const sourceKey = String(item?.sourceKey ?? "");
      const sentences = Array.isArray(item?.sentences) ? item.sentences.map((x) => String(x).trim()).filter(Boolean) : [];
      if (hasValidExampleSet(sentences)) {
        target[sourceKey] = dedupe(sentences).slice(0, 2);
      }
    }
  }
}

async function fillPronunciations(cards, target) {
  const pending = cards.filter((card) => !isValidPronunciation(target[card.sourceKey]));

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const prompt = [
      "You write one accurate IPA pronunciation for each vocabulary card term.",
      "Rules:",
      "1. Pronounce the card term itself in the card language, not the English lemma.",
      "2. Return exactly one broad IPA transcription per item.",
      "3. Wrap the IPA in forward slashes, like /.../.",
      "4. If the term is a phrase, transcribe the whole phrase naturally.",
      "5. No explanations or alternates.",
      '6. Return valid JSON only with this shape: {"items":[{"sourceKey":"...","pronunciation":"/.../"}]}',
      "",
      "Cards:",
      ...batch.map((card) => JSON.stringify(card)),
    ].join("\n");

    const parsed = await createJsonCompletion(PRONUNCIATION_MODEL, prompt);
    for (const item of parsed.items ?? []) {
      const sourceKey = String(item?.sourceKey ?? "");
      const pronunciation = normalizePronunciation(String(item?.pronunciation ?? ""));
      if (isValidPronunciation(pronunciation)) {
        target[sourceKey] = pronunciation;
      }
    }
  }
}

async function fillMeanings(rows, target) {
  const concepts = rows.map((row) => ({
    meaningKey: createCardSourceKey("en", row.tier, row.englishKey, row.partOfSpeech, row.termKind),
    englishKey: row.englishKey,
    partOfSpeech: row.partOfSpeech,
    termKind: row.termKind,
    translations: row.translations,
  }));

  for (const locale of NON_ENGLISH_LOCALES) {
    const prompt = [
      `You write up to 3 short translation meanings in ${locale} for each English vocabulary sense.`,
      "Rules:",
      "1. Respect the intended sense of the English key.",
      "2. Return 1 to 3 short meanings in priority order.",
      "3. Keep meanings unique and concise.",
      "4. Reuse the provided primary translation first when it fits.",
      '5. Return valid JSON only with this shape: {"items":[{"meaningKey":"...","meanings":["..."]}]}',
      "",
      "Concepts:",
      ...concepts.map((concept) =>
        JSON.stringify({
          meaningKey: concept.meaningKey,
          englishKey: concept.englishKey,
          partOfSpeech: concept.partOfSpeech,
          termKind: concept.termKind,
          primaryTranslation: concept.translations[locale],
        }),
      ),
    ].join("\n");

    const parsed = await createJsonCompletion(MEANING_MODEL, prompt);
    for (const item of parsed.items ?? []) {
      const meaningKey = String(item?.meaningKey ?? "");
      const meanings = normalizeMeaningList(item?.meanings);
      if (meanings.length > 0) {
        target[meaningKey] ??= {};
        target[meaningKey][locale] = meanings;
      }
    }
  }
}

function writeExamples(data) {
  const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b, "en")));
  const output =
    `export const CARD_EXAMPLE_SENTENCES: Record<string, string[]> = ${JSON.stringify(sorted, null, 2)};\n`;
  fs.writeFileSync("src/data/card-examples.generated.ts", output);
}

function writePronunciations(data) {
  const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b, "en")));
  const output =
    `export const CARD_PRONUNCIATIONS: Record<string, string> = ${JSON.stringify(sorted, null, 2)};\n`;
  fs.writeFileSync("src/data/card-pronunciations.generated.ts", output);
}

function writeMeanings(data) {
  const sortedOuter = Object.fromEntries(
    Object.entries(data)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([key, locales]) => [
        key,
        Object.fromEntries(Object.entries(locales).sort(([a], [b]) => a.localeCompare(b, "en"))),
      ]),
  );
  const output =
    `export const CARD_TRANSLATION_MEANINGS: Record<string, Partial<Record<string, string[]>>> = ${JSON.stringify(sortedOuter, null, 2)};\n`;
  fs.writeFileSync("src/data/card-translation-meanings.generated.ts", output);
}

function hasValidExampleSet(value) {
  return Array.isArray(value) && dedupe(value.map((x) => String(x).trim()).filter(Boolean)).length === 2;
}

function dedupe(values) {
  return [...new Set(values.map((value) => value.normalize("NFC")))];
}

function normalizeMeaningList(value) {
  return dedupe((Array.isArray(value) ? value : []).map((x) => String(x).trim()).filter(Boolean)).slice(0, 3);
}

function normalizePronunciation(value) {
  const trimmed = String(value ?? "").trim().normalize("NFC");
  if (/^\[.+\]$/u.test(trimmed)) {
    return `/${trimmed.slice(1, -1)}/`;
  }
  return trimmed;
}

function isValidPronunciation(value) {
  return /^\/.+\/$/u.test(String(value ?? "").trim());
}

async function createJsonCompletion(model, prompt, attempt = 1) {
  try {
    const response = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Model returned empty content.");
    }
    return JSON.parse(content);
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
      return createJsonCompletion(model, prompt, attempt + 1);
    }
    throw error;
  }
}

function createCardSourceKey(language, tier, term, partOfSpeech, termKind = "word") {
  return [language, tier, termKind, encodeKeyPart(term), encodeKeyPart(partOfSpeech)].join(":");
}

function encodeKeyPart(value) {
  return encodeURIComponent(String(value).normalize("NFC").toLocaleLowerCase("en"));
}

function loadEnvFile(filename) {
  const filePath = path.resolve(filename);
  if (!fs.existsSync(filePath)) {
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
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

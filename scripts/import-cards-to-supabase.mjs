import fs from "node:fs";
import { Module } from "node:module";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const BATCH_SIZE = 100;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
  process.exit(1);
}

const { VOCABULARY_CARDS } = loadTsModule("src/data/cards.ts");
const { LANGUAGES } = loadTsModule("src/data/languages.ts");
const supabase = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

console.log("Supabase kart kataloğu import ediliyor...");

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

for (let index = 0; index < VOCABULARY_CARDS.length; index += BATCH_SIZE) {
  const batch = VOCABULARY_CARDS.slice(index, index + BATCH_SIZE).map((card) => ({
    source_key: card.sourceKey,
    language_code: card.language,
    tier: card.tier,
    term: card.term,
    translation_tr: card.translation,
    pronunciation: card.pronunciation,
    part_of_speech: card.partOfSpeech,
    example: card.example,
    example_translation_tr: card.exampleTranslation,
    examples: card.examples,
    grammar: card.grammar,
  }));

  const { error } = await supabase.from("cards").upsert(batch, { onConflict: "source_key" });

  if (error) {
    throw error;
  }

  console.log(`- ${Math.min(index + BATCH_SIZE, VOCABULARY_CARDS.length)}/${VOCABULARY_CARDS.length}`);
}

console.log(`Tamamlandı: ${VOCABULARY_CARDS.length} kart import edildi.`);

function loadTsModule(relativePath) {
  const filename = path.resolve(relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const tsModule = new Module(filename);

  tsModule.filename = filename;
  tsModule.paths = Module._nodeModulePaths(process.cwd());
  tsModule._compile(output, filename);

  return tsModule.exports;
}

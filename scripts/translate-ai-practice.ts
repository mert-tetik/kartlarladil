import { writeFileSync } from "node:fs";
import OpenAI from "openai";
import {
  AI_PRACTICE_CHARACTER_DATA,
  OPENING_LINES,
} from "../src/features/ai-practice/ai-practice-data";
import { LANGUAGE_BY_CODE } from "../src/data/languages";
import type { LanguageCode, LocaleCode } from "../src/types/domain";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TARGET_LOCALES: LocaleCode[] = ["de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];

const localeInstructions: Record<string, string> = {
  ar: "Use Modern Standard Arabic that sounds natural and warm for chat conversations.",
  ja: "Use natural, conversational Japanese appropriate for the character's age and personality.",
  ko: "Use natural, friendly Korean appropriate for the character's age and personality.",
  "zh-CN": "Use natural, conversational Simplified Chinese appropriate for the character.",
};

async function translateCharacter(characterId: string, promptProfile: string, conversationStyle: string[], openingLines: string[]) {
  const targets = TARGET_LOCALES.map((locale) => `${LANGUAGE_BY_CODE[locale].nativeName} (${locale})`).join(", ");
  const extra = TARGET_LOCALES.map((locale) => localeInstructions[locale] ?? null).filter(Boolean).join(" ");

  const prompt = `You are localizing AI practice characters for FoxiesDeck, a language-learning chat app. Users chat with these characters to practice a target language. Translate the following character definition into these languages: ${targets}.

Character ID: ${characterId}
English promptProfile: ${promptProfile}
English conversationStyle:
${conversationStyle.map((s) => `- ${s}`).join("\n")}
English openingLines (greetings to start the chat):
${openingLines.map((l) => `- ${l}`).join("\n")}

Rules:
1. Keep the character personality consistent across languages.
2. Keep "FoxiesDeck" unchanged.
3. Use warm, natural, conversational language that fits a chat practice context.
4. ${extra}
5. Return strictly valid JSON in this exact format: {"de": {"promptProfile": "...", "conversationStyle": ["...", "...", "..."], "openingLines": ["...", "...", "..."]}, ...}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`No response for ${characterId}`);

  return JSON.parse(content) as Record<
    LocaleCode,
    { promptProfile: string; conversationStyle: string[]; openingLines: string[] }
  >;
}

async function main() {
  const promptProfilesByLocale: Record<string, Partial<Record<LocaleCode, string>>> = {};
  const conversationStylesByLocale: Record<string, Partial<Record<LocaleCode, string[]>>> = {};
  const openingLinesByLanguage: Record<string, Partial<Record<LanguageCode, string[]>>> = {};

  for (const character of AI_PRACTICE_CHARACTER_DATA) {
    console.log(`[${character.id}] translating character...`);
    const existingOpeningLines = OPENING_LINES[character.id] as Record<LanguageCode, string[]> | undefined;
    const translated = await translateCharacter(
      character.id,
      character.promptProfile,
      character.conversationStyle,
      existingOpeningLines?.en ?? ["Hello!"],
    );

    promptProfilesByLocale[character.id] = {};
    conversationStylesByLocale[character.id] = {};
    openingLinesByLanguage[character.id] = { ...(existingOpeningLines ?? {}) };

    for (const locale of TARGET_LOCALES) {
      const t = translated[locale];
      if (!t) continue;
      promptProfilesByLocale[character.id][locale] = t.promptProfile;
      conversationStylesByLocale[character.id][locale] = t.conversationStyle;
      (openingLinesByLanguage[character.id] as Record<LanguageCode, string[]>)[locale as LanguageCode] = t.openingLines;
    }
  }

  const fileContent = `import type { LanguageCode, LocaleCode } from "@/types/domain";

export const PROMPT_PROFILES_BY_LOCALE: Record<string, Partial<Record<LocaleCode, string>>> = ${JSON.stringify(
    promptProfilesByLocale,
    null,
    2,
  )};

export const CONVERSATION_STYLES_BY_LOCALE: Record<string, Partial<Record<LocaleCode, string[]>>> = ${JSON.stringify(
    conversationStylesByLocale,
    null,
    2,
  )};

export const OPENING_LINES_BY_LANGUAGE: Record<string, Partial<Record<LanguageCode, string[]>>> = ${JSON.stringify(
    openingLinesByLanguage,
    null,
    2,
  )};
`;

  writeFileSync("src/features/ai-practice/ai-practice-localization.ts", fileContent);
  console.log("Wrote src/features/ai-practice/ai-practice-localization.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

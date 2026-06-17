import { writeFileSync } from "node:fs";
import OpenAI from "openai";
import { legalContent } from "../src/features/legal/content";
import { LANGUAGE_BY_CODE } from "../src/data/languages";
import type { LocaleCode } from "../src/types/domain";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TARGET_LOCALES: LocaleCode[] = ["de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];

const extra: Record<string, string> = {
  ar: "Use Modern Standard Arabic appropriate for legal documents.",
  ja: "Use natural Japanese for legal documents; keep sentences clear.",
  ko: "Use polite, clear Korean suitable for legal documents.",
  "zh-CN": "Use clear, formal Simplified Chinese suitable for legal documents.",
};

async function translateTerms(locale: LocaleCode) {
  const localeName = LANGUAGE_BY_CODE[locale].nativeName;
  const englishTerms = legalContent.en.terms;

  const prompt = `You are translating the Terms of Service "Acceptable Use" section for FoxiesDeck, a language-learning web app, into ${localeName}.

Rules:
1. Translate only the text content; keep all HTML tags, attribute values, email addresses, and URLs unchanged.
2. Keep the company name "FoxiesDeck" unchanged.
3. Use formal but clear language suitable for legal/terms pages.
4. ${extra[locale] ?? "Use natural, formal language appropriate for legal documents."}
5. Return only the translated HTML string (no markdown code fences, no extra commentary).

HTML to translate:
${englishTerms}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`No response for ${locale}`);

  return content.trim();
}

async function main() {
  const translated: Record<LocaleCode, Record<string, string>> = { ...legalContent } as Record<
    LocaleCode,
    Record<string, string>
  >;

  for (const locale of TARGET_LOCALES) {
    console.log(`[${locale}] translating terms...`);
    const terms = await translateTerms(locale);
    translated[locale] = { ...translated[locale], terms };
  }

  const today = new Date().toISOString().split("T")[0];
  const fileContent = `import type { LocaleCode } from "@/types/domain";

export const LEGAL_LAST_UPDATED = "${today}";

export const legalContent: Record<
  LocaleCode,
  Record<"terms" | "privacy" | "refund" | "cookies" | "subscriptions", string>
> = ${JSON.stringify(translated, null, 2)};
`;

  writeFileSync("src/features/legal/content.ts", fileContent);
  console.log("Wrote src/features/legal/content.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

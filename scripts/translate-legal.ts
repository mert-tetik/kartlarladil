import { writeFileSync } from "node:fs";
import OpenAI from "openai";
import { legalContent } from "../src/features/legal/content";
import { LANGUAGE_BY_CODE } from "../src/data/languages";
import type { LocaleCode } from "../src/types/domain";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TARGET_LOCALES: LocaleCode[] = ["de", "ru", "fr", "es", "it", "pt", "nl", "pl", "ar", "ja", "ko", "zh-CN"];

const pageTitles: Record<string, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  refund: "Refund Policy",
  cookies: "Cookie Policy",
  subscriptions: "Subscription Terms",
};

const extra: Record<string, string> = {
  ar: "Use Modern Standard Arabic appropriate for legal documents.",
  ja: "Use natural Japanese for legal documents; keep sentences clear.",
  ko: "Use polite, clear Korean suitable for legal documents.",
  "zh-CN": "Use clear, formal Simplified Chinese suitable for legal documents.",
};

async function translateLegalContent(locale: LocaleCode) {
  const localeName = LANGUAGE_BY_CODE[locale].nativeName;
  const pages = Object.entries(legalContent.en).map(([page, html]) => ({
    page,
    title: pageTitles[page],
    html,
  }));

  const body = pages
    .map(
      (p) =>
        `PAGE: ${p.page}\nTITLE: ${p.title}\nHTML:\n${p.html}\n---`,
    )
    .join("\n");

  const prompt = `You are translating legal pages for FoxiesDeck, a language-learning web app. Translate the following English legal HTML pages into ${localeName}.

Rules:
1. Keep all HTML tags, attribute values, email addresses, and URLs unchanged.
2. Keep the company name "FoxiesDeck" unchanged.
3. Use formal but clear language suitable for legal/terms pages.
4. ${extra[locale] ?? "Use natural, formal language appropriate for legal documents."}
5. Return strictly valid JSON in this exact format: {"terms": "<h2>...</h2>", "privacy": "...", "refund": "...", "cookies": "...", "subscriptions": "..."}

${body}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`No response for ${locale}`);

  return JSON.parse(content) as Record<string, string>;
}

async function main() {
  const translated: Record<LocaleCode, Record<string, string>> = { ...legalContent } as Record<
    LocaleCode,
    Record<string, string>
  >;

  for (const locale of TARGET_LOCALES) {
    console.log(`[${locale}] translating legal pages...`);
    const pages = await translateLegalContent(locale);
    translated[locale] = pages;
  }

  const fileContent = `import type { LocaleCode } from "@/types/domain";

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
